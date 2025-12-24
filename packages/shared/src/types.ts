export type Language = "ar" | "en";

export interface Meeting {
  id: string;
  orgId: string;
  title: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  location: string;
  agenda: string;
  createdBy: string;
  createdAt: string;
}

export interface Minutes {
  id: string;
  meetingId: string;
  orgId: string;
  language: Language;
  status: "draft" | "reviewed" | "approved";
  currentVersionId: string;
  createdBy: string;
  createdAt: string;
}

export interface MinutesVersion {
  id: string;
  minutesId: string;
  versionNumber: number;
  contentJson: unknown;
  diffPrevious?: unknown;
  createdBy: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  isLocked: boolean;
}

export interface ActionItem {
  id: string;
  versionId: string;
  title: string;
  ownerUserId: string;
  dueDate: string;
  status: "open" | "in_progress" | "done";
}
