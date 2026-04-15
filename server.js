const express = require("express");
const axios = require("axios");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ================= FIREBASE =================
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ================= ENV =================
const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  SHORTCODE,
  PASSKEY
} = process.env;

// ================= ACCESS TOKEN =================
async function getAccessToken() {
  const auth = Buffer.from(
    `${CONSUMER_KEY}:${CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`
      }
    }
  );

  return response.data.access_token;
}

// ================= STK PUSH =================
app.post("/stkpush", async (req, res) => {

  try {

    const { phone, amount } = req.body;

    const token = await getAccessToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:\.Z]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      SHORTCODE + PASSKEY + timestamp
    ).toString("base64");

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: "https://e47-backend-production.up.railway.app/callback",
        AccountReference: "E-47 FARMERS",
        TransactionDesc: "Farm Payment"
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.log(error.message);
    res.json({ success: false });
  }
});

// ================= CALLBACK (DELIVERY SYSTEM) =================
app.post("/callback", async (req, res) => {
  try {

    const result = req.body.Body.stkCallback;

    console.log("CALLBACK:", JSON.stringify(req.body, null, 2));

    if (result.ResultCode !== 0) {
      return res.sendStatus(200);
    }

    const items = result.CallbackMetadata.Item;

    const order = {
      phone: items.find(i => i.Name === "PhoneNumber").Value,
      amount: items.find(i => i.Name === "Amount").Value,
      receipt: items.find(i => i.Name === "MpesaReceiptNumber").Value,
      transactionDate: items.find(i => i.Name === "TransactionDate").Value,
      status: "processing",
      createdAt: new Date()
    };

    await db.collection("orders").add(order);

    res.sendStatus(200);

  } catch (error) {
    console.log(error);
    res.sendStatus(200);
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
