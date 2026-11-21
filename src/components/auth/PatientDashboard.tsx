import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Phone, Mail, Clock, FileText, LogOut } from "lucide-react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import DentalNavbar from "@/components/DentalNavbar";
import DentalFooter from "@/components/DentalFooter";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

interface PatientDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

type Appointment = Tables<"appointments">;

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// "2026-11-23" is a calendar date; parse it as local midnight, not UTC
const formatDate = (isoDate: string) => new Date(`${isoDate}T00:00`).toLocaleDateString();
const formatTime = (time: string) =>
  new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const PatientDashboard = ({ user, onLogout }: PatientDashboardProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hasPatientRecord, setHasPatientRecord] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const navigate = useNavigate();

  const fullName = (user.user_metadata?.full_name as string | undefined) || user.email;
  const phone = user.user_metadata?.phone as string | undefined;

  useEffect(() => {
    fetchUserAppointments();
  }, [user.id]);

  // Access rules only return this user's own patient record and appointments,
  // so no email filter is needed (or trusted)
  const fetchUserAppointments = async () => {
    setLoading(true);
    setLoadError(false);

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .maybeSingle();

    if (patientError) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    if (!patient) {
      // No booking has been made with this email yet
      setHasPatientRecord(false);
      setAppointments([]);
      setLoading(false);
      return;
    }

    setHasPatientRecord(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', patient.id)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (error) {
      setLoadError(true);
    } else {
      setAppointments(data ?? []);
    }
    setLoading(false);
  };

  const today = todayIso();
  const upcomingAppointments = appointments.filter(apt =>
    apt.appointment_date >= today && apt.status === 'scheduled'
  );

  const pastAppointments = appointments
    .filter(apt => apt.appointment_date < today || apt.status !== 'scheduled')
    .reverse();
  const visibleHistory = showAllHistory ? pastAppointments : pastAppointments.slice(0, 6);

  return (
    <div className="min-h-screen bg-background font-inter">
      <DentalNavbar />

      <div className="pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground font-inter">
                Welcome, {fullName}
              </h1>
              <p className="text-dental-gray mt-2">
                Manage your appointments and dental records
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          {loadError && (
            <div role="alert" className="mb-8 rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-destructive">We couldn't load your appointments.</p>
              <Button variant="outline" size="sm" onClick={fetchUserAppointments}>Try again</Button>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {/* User Profile Card */}
            <Card className="border-dental-blue-light">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-dental-blue" />
                  <span>Profile Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-dental-gray" />
                  <span className="text-sm break-all">{user.email}</span>
                </div>
                {phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="h-4 w-4 text-dental-gray" />
                    <span className="text-sm">{phone}</span>
                  </div>
                )}
                <div className="pt-4">
                  <Button
                    variant="dental"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate('/booking')}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Book New Appointment
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Appointments */}
            <Card className="lg:col-span-2 border-dental-blue-light">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-dental-blue" />
                  <span>Upcoming Appointments</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <LoadingSkeleton type="appointment" count={3} />
                ) : upcomingAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingAppointments.map((appointment) => (
                      <div key={appointment.id} className="border rounded-lg p-4 hover:bg-dental-blue-light/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-foreground">{appointment.service_type}</h4>
                            <p className="text-sm text-dental-gray">{appointment.doctor}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4 text-dental-gray" />
                                <span className="text-sm">{formatDate(appointment.appointment_date)}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="h-4 w-4 text-dental-gray" />
                                <span className="text-sm">{formatTime(appointment.appointment_time)}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {appointment.status}
                          </Badge>
                        </div>
                        {appointment.notes && (
                          <p className="text-sm text-dental-gray mt-2 italic">
                            Notes: {appointment.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-dental-gray mx-auto mb-4" />
                    <p className="text-dental-gray">
                      {hasPatientRecord
                        ? "No upcoming appointments"
                        : `No bookings found for ${user.email} yet. Bookings made with this email will show up here.`}
                    </p>
                    <Button
                      variant="dental"
                      size="sm"
                      className="mt-4"
                      onClick={() => navigate('/booking')}
                    >
                      Schedule Your First Appointment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Past Appointments */}
            {pastAppointments.length > 0 && (
              <Card className="lg:col-span-3 border-dental-blue-light">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-dental-blue" />
                    <span>Appointment History</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {visibleHistory.map((appointment) => (
                      <div key={appointment.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-foreground">{appointment.service_type}</h5>
                          <Badge
                            variant={appointment.status === 'completed' ? 'default' : 'secondary'}
                            className={appointment.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {appointment.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-dental-gray">{appointment.doctor}</p>
                        <p className="text-sm text-dental-gray">
                          {formatDate(appointment.appointment_date)} at {formatTime(appointment.appointment_time)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {pastAppointments.length > 6 && (
                    <div className="text-center mt-4">
                      <Button variant="outline" size="sm" onClick={() => setShowAllHistory((shown) => !shown)}>
                        {showAllHistory ? "Show Less" : "View All History"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <DentalFooter />
    </div>
  );
};

export default PatientDashboard;
