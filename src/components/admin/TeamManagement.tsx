import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { UserCog, UserPlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { roleLabels, type StaffRole } from "@/lib/permissions";

type TeamMember = {
  user_id: string;
  email: string;
  roles: StaffRole[];
  last_sign_in_at: string | null;
};

const roleOptions: StaffRole[] = ["admin", "staff", "doctor"];

const roleDescriptions: Record<StaffRole, string> = {
  admin: "Everything, including billing, feedback, reports and this page",
  staff: "Patients, appointments, billing and contact messages",
  doctor: "Patients and appointments; no billing, no deleting",
};

interface TeamManagementProps {
  currentUserId: string;
}

// Admin-only page (the admin_* database functions refuse anyone else)
const TeamManagement = ({ currentUserId }: TeamManagementProps) => {
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [isSaving, setIsSaving] = useState(false);

  const fetchTeam = async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase.rpc("admin_list_team");
    if (error) {
      setLoadError(true);
    } else {
      setTeam((data ?? []) as TeamMember[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const setMemberRole = async (memberEmail: string, memberRole: StaffRole, grant: boolean) => {
    setIsSaving(true);
    const { error } = await supabase.rpc("admin_set_role", {
      p_email: memberEmail,
      p_role: memberRole,
      p_grant: grant,
    });
    setIsSaving(false);

    if (error) {
      toast({ title: "Couldn't update the role", description: error.message, variant: "destructive" });
      return false;
    }
    toast({
      title: grant ? "Role added" : "Role removed",
      description: `${memberEmail} ${grant ? "is now" : "is no longer"} ${roleLabels[memberRole]}.`,
    });
    await fetchTeam();
    return true;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const saved = await setMemberRole(email.trim(), role, true);
    if (saved) setEmail("");
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center justify-center space-x-3">
          <UserCog className="w-8 h-8 text-dental-blue" />
          <span>Team & Roles</span>
        </h1>
        <p className="text-dental-gray">Choose who can sign in to this panel and what each person can see.</p>
      </div>

      <Card className="border-dental-blue-light">
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-dental-blue" />
            <span>Add a team member</span>
          </CardTitle>
          <CardDescription>They need an account first: ask them to sign up at /signup with their work email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-[1fr_200px_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="teamEmail">Email</Label>
              <Input id="teamEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@clinic.example" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamRole">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as StaffRole)}>
                <SelectTrigger id="teamRole"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option} value={option}>{roleLabels[option]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="dental" disabled={isSaving}>
              {isSaving ? "Saving..." : "Add role"}
            </Button>
          </form>
          <ul className="mt-4 space-y-1 text-sm text-dental-gray">
            {roleOptions.map((option) => (
              <li key={option}><span className="font-medium text-foreground">{roleLabels[option]}:</span> {roleDescriptions[option]}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-dental-blue-light">
        <CardHeader>
          <CardTitle className="text-lg">Current team</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSkeleton className="h-24" />
          ) : loadError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-destructive">Couldn't load the team.</p>
              <Button variant="outline" size="sm" onClick={fetchTeam}>Try again</Button>
            </div>
          ) : team.length === 0 ? (
            <p className="text-dental-gray">No team members yet.</p>
          ) : (
            <ul className="divide-y">
              {team.map((member) => (
                <li key={member.user_id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground break-all">
                      {member.email}{member.user_id === currentUserId && <span className="text-dental-gray font-normal"> (you)</span>}
                    </p>
                    <p className="text-xs text-dental-gray">
                      {member.last_sign_in_at
                        ? `Last sign-in ${new Date(member.last_sign_in_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
                        : "Hasn't signed in yet"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {member.roles.map((memberRole) => {
                      const isOwnAdmin = memberRole === "admin" && member.user_id === currentUserId;
                      return (
                        <Badge key={memberRole} variant="secondary" className="flex items-center gap-1 pr-1">
                          {roleLabels[memberRole]}
                          {!isOwnAdmin && (
                            <button
                              type="button"
                              onClick={() => setMemberRole(member.email, memberRole, false)}
                              disabled={isSaving}
                              className="rounded p-0.5 hover:bg-destructive/10"
                              aria-label={`Remove ${roleLabels[memberRole]} role from ${member.email}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamManagement;
