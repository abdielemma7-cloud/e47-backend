// ================= IMPORTS =================
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import admin from "firebase-admin";

// ================= FIREBASE (SAFE INIT) =================
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

// ================= APP CONFIG =================
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ================= M-PESA CONFIG =================
const consumerKey = "YOUR_CONSUMER_KEY";
const consumerSecret = "YOUR_CONSUMER_SECRET";
const shortcode = "174379"; // sandbox
const passkey = "YOUR_PASSKEY";
const callbackURL = "https://e47-backend-production.up.railway.app/mpesa-callback";

// ================= GET ACCESS TOKEN =================
async function getAccessToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const res = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`
      }
    }
  );

  return res.data.access_token;
}

// ================= STK PUSH =================
app.post("/stkpush", async (req, res) => {
  try {
    const { phone, amount, productId, buyerEmail, farmerEmail } = req.body;

    const token = await getAccessToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, "")
      .slice(0, 14);

    const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

    const stkData = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackURL,
      AccountReference: productId,
      TransactionDesc: "E47 Payment"
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      stkData,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.json({
      success: true,
      message: "STK Push sent",
      data: response.data
    });

  } catch (err) {
    console.log(err.response?.data || err.message);

    res.json({
      success: false,
      message: "STK failed"
    });
  }
});

// ================= CALLBACK =================
app.post("/mpesa-callback", async (req, res) => {
  try {
    const data = req.body;

    console.log("📩 CALLBACK RECEIVED:", JSON.stringify(data, null, 2));

    const result = data?.Body?.stkCallback;

    if (result?.ResultCode === 0) {

      const meta = result.CallbackMetadata.Item;

      const phone = meta.find(i => i.Name === "PhoneNumber")?.Value;
      const amount = meta.find(i => i.Name === "Amount")?.Value;
      const receipt = meta.find(i => i.Name === "MpesaReceiptNumber")?.Value;

      console.log("✅ PAYMENT SUCCESS:", phone, amount, receipt);

      // ================= SAVE ORDER =================
      await db.collection("orders").add({
        phone,
        amount,
        receipt,
        status: "paid",
        createdAt: new Date()
      });

    } else {
      console.log("❌ PAYMENT FAILED");
    }

    res.json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });

  } catch (err) {
    console.log(err.message);

    res.json({
      ResultCode: 1,
      ResultDesc: "Error"
    });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
