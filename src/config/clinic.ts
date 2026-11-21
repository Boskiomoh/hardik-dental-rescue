// One place for the clinic's name and contact details, so every page shows
// the same ones. The values are fictional demo placeholders.
export const clinic = {
  name: "Hardik Dental",
  phone: "(555) 123-4567",
  phoneHref: "tel:+15551234567",
  emergencyPhone: "(555) 123-4568",
  email: "hello@hardikdental.example",
  address: ["123 Smile Street", "Downtown District", "City, ST 12345"],
  hours: ["Mon–Sat: 9AM–5PM", "Sun: Closed"],
} as const;
