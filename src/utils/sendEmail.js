const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const port = Number(process.env.SMTP_PORT) || 587;
    const isSecure = port === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, "") : "",
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || `"EstateGold" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || "",
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✉️ SMTP Email sent successfully to:", to, "| Message ID:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Failed to send SMTP Email to", to, ":", error.message || error);
    return { success: false, error: error.message || "SMTP delivery failed" };
  }
};

module.exports = sendEmail;
