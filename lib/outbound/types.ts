export type OutboundIntent = "send_proposal" | "notify_customer" | "contact_supplier";
export type OutboundChannel = "email" | "whatsapp";

export type OutboundDraft = {
  /** Deterministic: `${actionId}:${recipientId}`. */
  id: string;
  actionId: string;
  actionType: string;
  exceptionId: string;
  intent: OutboundIntent;
  channel: OutboundChannel;
  toEntityId: string | null;
  toName: string;
  toAddress: string | null;
  subject: string;
  body: string;
};

export type OutboundMessage = OutboundDraft & {
  draftId: string;
  provider: string;
  external: boolean;
  status: "recorded_local" | "sent";
  approvedBy: string;
  recordedAt: string;
};
