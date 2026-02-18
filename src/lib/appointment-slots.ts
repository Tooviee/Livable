/**
 * Available time slots for Zoom appointments (KST-friendly).
 * value is stored in DB; label is for display.
 */
export const APPOINTMENT_TIME_SLOTS = [
  { value: "09:00-10:00", label: "9:00 AM – 10:00 AM" },
  { value: "10:00-11:00", label: "10:00 AM – 11:00 AM" },
  { value: "11:00-12:00", label: "11:00 AM – 12:00 PM" },
  { value: "14:00-15:00", label: "2:00 PM – 3:00 PM" },
  { value: "15:00-16:00", label: "3:00 PM – 4:00 PM" },
  { value: "16:00-17:00", label: "4:00 PM – 5:00 PM" },
  { value: "17:00-18:00", label: "5:00 PM – 6:00 PM" },
] as const;

export const APPOINTMENT_SLOT_VALUES = new Set(APPOINTMENT_TIME_SLOTS.map((s) => s.value));

export function isValidAppointmentSlot(value: string): boolean {
  return (APPOINTMENT_SLOT_VALUES as Set<string>).has(value);
}

export function getAppointmentSlotLabel(value: string): string {
  return APPOINTMENT_TIME_SLOTS.find((s) => s.value === value)?.label ?? value;
}
