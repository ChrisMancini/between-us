export interface SerializedPerson {
  _id: string;
  key: string;
  displayName: string;
  role: "admin" | "user";
  colorIndex: 0 | 1;
  emails?: Record<string, string>;
}

export type PersonPair = [SerializedPerson, SerializedPerson];
