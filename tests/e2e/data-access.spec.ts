import { expect, test } from "@playwright/test";
import { accessToken, supabaseRest } from "./helpers";

// BUGS.md B02, B05, B08: calls Supabase directly with the public key that
// ships in the browser, the way an attacker would

test.describe("anonymous visitor", () => {
  for (const table of ["patients", "appointments", "patient_financials", "patient_services", "feedback", "user_roles"]) {
    test(`can't read ${table}`, async () => {
      const { body } = await supabaseRest(`/rest/v1/${table}?select=id`);
      expect(body).toEqual([]);
    });
  }

  test("can't change or delete financial records", async () => {
    const patch = await supabaseRest("/rest/v1/patient_financials?id=not.is.null", {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ amount_paid_by_patient: 0 }),
    });
    expect(patch.body).toEqual([]);
    const del = await supabaseRest("/rest/v1/patient_financials?id=not.is.null", {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    expect(del.body).toEqual([]);
  });

  test("can't mark feedback as reviewed", async () => {
    const { body } = await supabaseRest("/rest/v1/feedback?id=not.is.null", {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "reviewed" }),
    });
    expect(body).toEqual([]);
  });

  test("sees taken times but not who booked them", async () => {
    const { body } = await supabaseRest("/rest/v1/rpc/get_booked_slots", {
      method: "POST",
      body: JSON.stringify({ p_date: "2030-01-07", p_doctor: "Dr. Smith" }),
    });
    expect(Array.isArray(body)).toBe(true);
    for (const slot of body) expect(typeof slot).toBe("string");
  });

  test("can't call the team management functions", async () => {
    const { status } = await supabaseRest("/rest/v1/rpc/admin_list_team", { method: "POST", body: "{}" });
    expect(status).toBeGreaterThanOrEqual(400);
  });
});

test.describe("signed-in roles", () => {
  test("a patient reads only their own patient record", async () => {
    const token = await accessToken("PATIENT");
    const { body } = await supabaseRest("/rest/v1/patients?select=email", { token });
    expect(body).toEqual([{ email: "patient.demo@example.com" }]);
  });

  test("a doctor can't read billing", async () => {
    const token = await accessToken("DOCTOR");
    const { body } = await supabaseRest("/rest/v1/patient_financials?select=id", { token });
    expect(body).toEqual([]);
  });

  test("front desk reads contact messages but not reviews", async () => {
    const token = await accessToken("STAFF");
    const { body } = await supabaseRest("/rest/v1/feedback?select=category", { token });
    expect(body.length).toBeGreaterThan(0);
    expect(new Set(body.map((row: { category: string }) => row.category))).toEqual(new Set(["contact"]));
  });

  test("only an admin can list the team", async () => {
    const staff = await supabaseRest("/rest/v1/rpc/admin_list_team", { method: "POST", body: "{}", token: await accessToken("STAFF") });
    expect(staff.status).toBeGreaterThanOrEqual(400);
    const admin = await supabaseRest("/rest/v1/rpc/admin_list_team", { method: "POST", body: "{}", token: await accessToken("ADMIN") });
    expect(admin.status).toBe(200);
    expect(admin.body.length).toBeGreaterThanOrEqual(3);
  });
});
