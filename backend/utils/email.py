import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config.settings import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD


def send_verification_email(to_email: str, code: str) -> bool:
    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = "CogniCare - Email Verification"

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: #0ea5e9; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">CogniCare</h1>
            <p style="margin: 5px 0 0; opacity: 0.9;">Email Verification</p>
        </div>
        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #475569; margin-bottom: 20px;">Use the following code to verify your email:</p>
            <div style="background: white; border: 2px dashed #0ea5e9; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #0ea5e9; letter-spacing: 8px;">{code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">This code expires in 10 minutes.</p>
        </div>
    </div>
    """

    msg.attach(MIMEText(html, "html"))

    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, msg.as_string())
        server.quit()
        return True
    except Exception:
        return False
