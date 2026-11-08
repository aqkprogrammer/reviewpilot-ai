# WhatsApp Cloud API integration

Adapter: `WhatsAppCloudAdapter` in `app/providers/messaging.py` (Graph API
`https://graph.facebook.com/{WHATSAPP_API_VERSION}`).

## Setup (per organization, or platform-wide)
1. Create a Meta Business account and a **Meta app** (type: Business) with the WhatsApp product.
2. Create/attach a **WhatsApp Business Account (WABA)** and register a phone number. Note the
   **Phone number ID** and **WhatsApp Business Account ID**.
3. Create a **System User** in Business Settings with `whatsapp_business_messaging` and
   `whatsapp_business_management` permissions and generate a **permanent access token**.
4. In ReviewPilot → Integrations → WhatsApp, enter phone number ID, WABA ID and token
   (`PUT /integrations/whatsapp`). ReviewPilot verifies them against the Graph API before marking
   the integration connected, and stores the token encrypted. A platform-level number can be set
   with `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_BUSINESS_ACCOUNT_ID`.

## Templates & approval
Business-initiated messages must use an **approved template**. ReviewPilot ships system
templates whose Meta names are `review_request_en`, `review_request_hi`, `review_request_hinglish`
(body parameters: customer first name, business name, tracked link). Create matching templates in
WhatsApp Manager (category **Utility**), wait for approval, then run
`POST /integrations/whatsapp/templates/sync` to pull approval statuses. Org templates can set
`provider_template_name` to any approved template.

## Webhooks
Callback URL: `https://api.reviewpilot.ai/api/v1/webhooks/whatsapp` (or through the web origin).
- `WHATSAPP_VERIFY_TOKEN`: any random string; Meta's `GET` verification echoes `hub.challenge`
  only when it matches.
- `WHATSAPP_APP_SECRET`: the Meta app secret; every `POST` must carry a valid
  `X-Hub-Signature-256`, otherwise it is rejected (400).
- Subscribe the app to the `messages` field. Status updates (`sent`, `delivered`, `read`,
  `failed`) update `message_deliveries` and `review_requests` idempotently.

## Consent & opt-out
- A review request is only sent when the customer has a **granted transactional consent for
  WhatsApp** in `customer_consents` and has not opted out (`services/consent.can_message`).
  Collecting a phone number for a service transaction does not by itself grant consent; CSV
  imports record consent only when the importer explicitly confirms it.
- Inbound replies `STOP`, `unsubscribe`, `band karo`, `रोकें` opt the customer out (revocation
  recorded with the message id). Email/SMS links also include an unsubscribe path.
- WhatsApp campaigns require the Growth plan or higher.

## Demo mode
With `DEMO_MODE=true` and no credentials, the `MockAdapter` simulates acceptance (numbers ending
in `0000` simulate failures). Deliveries are stored with `provider="mock"` and the UI labels them
as simulated. In production without credentials the channel shows "Connect WhatsApp to send".
