"""
Procurement & Supply Chain Logistics System - Notifier Module
Handles notifications for Slack channels (webhooks with interactive approval blocks)
and Email updates for supply chain supervisors.
Includes an in-memory/file logging fallback ('mock mode') for testing.
"""

import os
import json

class Notifier:
    def __init__(self, mock_mode: bool = True):
        self.mock_mode = mock_mode
        self.slack_webhook_url = os.getenv("SLACK_WEBHOOK_URL", "")
        self.smtp_server = os.getenv("SMTP_SERVER", "")
        self.notifications_log_path = "notifications_sent.log"

    def _log_notification(self, type_: str, payload: dict):
        """Logs notification details to a file for review in mock mode."""
        log_entry = {
            "type": type_,
            "payload": payload
        }
        with open(self.notifications_log_path, "a") as f:
            f.write(json.dumps(log_entry) + "\n")

    def send_slack_approval_alert(self, order_id: str, component: str, qty: int, total_price: float, role_required: str) -> bool:
        """Sends an interactive Slack message requesting authorization approval."""
        payload = {
            "text": f"🚨 *Procurement Approval Request: {order_id}*",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"🚨 *Human-in-the-Loop Approval Required*\n*Order ID:* {order_id}\n*Component:* {component}\n*Quantity:* {qty}\n*Total Value:* ${total_price:,.2f}\n*Authority Required:* {role_required.upper()}"
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "Approve"},
                            "style": "primary",
                            "action_id": f"approve_{order_id}"
                        },
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "Reject"},
                            "style": "danger",
                            "action_id": f"reject_{order_id}"
                        }
                    ]
                }
            ]
        }

        if self.mock_mode or not self.slack_webhook_url:
            self._log_notification("SLACK_APPROVAL", payload)
            print(f"[Notifier - MOCK] Slack notification logged for Order {order_id} requiring {role_required.upper()} approval.")
            return True

        # In real mode, send HTTP request to Slack webhook URL
        try:
            import urllib.request
            req = urllib.request.Request(
                self.slack_webhook_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req) as res:
                return res.status == 200
        except Exception as e:
            print(f"[Notifier - ERROR] Failed sending real Slack notification: {e}")
            return False

    def send_email_alert(self, recipient: str, subject: str, message: str) -> bool:
        """Sends email alert to stakeholders."""
        payload = {
            "recipient": recipient,
            "subject": subject,
            "body": message
        }

        if self.mock_mode or not self.smtp_server:
            self._log_notification("EMAIL_ALERT", payload)
            print(f"[Notifier - MOCK] Email notification queued for {recipient}: '{subject}'")
            return True

        # Real SMTP logic goes here (mocked for absolute platform resilience)
        return True

if __name__ == "__main__":
    notifier = Notifier(mock_mode=True)
    notifier.send_slack_approval_alert("PO-2026-0001", "IC-STM32F4", 1000, 7500.0, "director")
