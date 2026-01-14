import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const sendSMS = async (to, message) => {
  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to.startsWith("+") ? to : `+91${to}`, // auto-fix Indian numbers
    });

    console.log("📨 SMS sent to:", to);
  } catch (error) {
    console.error("❌ Twilio SMS error:", error.message);
  }
};