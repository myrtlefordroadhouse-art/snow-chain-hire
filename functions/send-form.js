const nodemailer = require("nodemailer");

exports.handler = async (event) => {
if (event.httpMethod !== "POST") {
return { statusCode: 405, body: "Method Not Allowed" };
}

try {
const { to, subject, html } = JSON.parse(event.body);

const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: process.env.SMTP_USER,
pass: process.env.SMTP_PASSWORD
}
});

await transporter.sendMail({
from: process.env.SMTP_USER,
to: to,
cc: process.env.ADMIN_EMAIL,
subject: subject,
html: html
});

return {
statusCode: 200,
body: JSON.stringify({ success: true })
};
} catch (error) {
return {
statusCode: 500,
body: JSON.stringify({ error: error.message })
};
}
};
