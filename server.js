const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// 🔐 ENV VARIABLES (from Railway)
// ===============================
const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  SHORTCODE,
  PASSKEY
} = process.env;

// ===============================
// 🔑 GET ACCESS TOKEN
// ===============================
async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

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

// ===============================
// 💰 STK PUSH (REAL M-PESA)
// ===============================
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

    const stkResponse = await axios.post(
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
        AccountReference: "E47 FARMERS",
        TransactionDesc: "Farm Product Payment"
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.json({
      success: true,
      message: "STK Push sent",
      data: stkResponse.data
    });

  } catch (error) {
    console.log(error.message);
    res.json({
      success: false,
      message: "STK Push failed"
    });
  }
});

// ===============================
// 📩 CALLBACK (Payment Result)
// ===============================
app.post("/callback", (req, res) => {
  console.log("M-PESA CALLBACK:", JSON.stringify(req.body, null, 2));

  res.sendStatus(200);
});

// ===============================
// 🌐 TEST ROUTE
// ===============================
app.get("/", (req, res) => {
  res.send("E-47 Farmers M-PESA Backend Running 🚀");
});

// ===============================
// 🚀 START SERVER
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
