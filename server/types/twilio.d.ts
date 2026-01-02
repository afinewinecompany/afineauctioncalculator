/**
 * Type declarations for Twilio SDK
 * Minimal typing for dynamic import usage
 */

declare module 'twilio' {
  interface MessageInstance {
    sid: string;
    body: string;
    from: string;
    to: string;
    status: string;
  }

  interface MessagesListInstance {
    create(options: {
      body: string;
      from: string;
      to: string;
    }): Promise<MessageInstance>;
  }

  interface TwilioClient {
    messages: MessagesListInstance;
  }

  function twilio(accountSid: string, authToken: string): TwilioClient;

  export = twilio;
}
