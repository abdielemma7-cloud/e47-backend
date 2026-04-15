const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 ENV VARIABLES
const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  SHORTCODE,
  PASSKEY
} = process.env;

// 🔑 GET ACCESS TOKEN
async function getToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

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

// 💰 STK PUSH
app.post("/stkpush", async (req, res) => {

  try {

    const { phone, amount } = req.body;

    const token = await getToken();

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
        CallBackURL: "https://yourdomain.com/callback",
        AccountReference: "E-47 FARMERS",
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
      data: response.data
    });

  } catch (error) {
    console.log(error);
    res.json({
      success: false
    });
  }
});

// 🌐 TEST ROUTE (VERY IMPORTANT)
app.get("/", (req, res) => {
  res.send("E-47 Backend Running 🚀");
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
