import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { 
  Users, 
  Calendar, 
  Activity,
  UserCheck,
  CalendarCheck,
  FileBarChart,
  Clock,
  CheckCircle,
  Plus,
  Eye
} from "lucide-react";
import { usePatients, useAppointments } from "@/hooks/useSupabase";

interface AdminDashboardProps {
  // Opens another admin tab (used by the quick actions)
  onNavigate?: (tab: string) => void;
}

const localToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const AdminDashboard = ({ onNavigate }: AdminDashboardProps) => {
  const { patients, loading: patientsLoading } = usePatients();
  const { appointments, loading: appointmentsLoading } = useAppointments();

  const today = localToday();
  const totalPatients = patients.length;
  const activePatients = patients.filter(p => p.status === 'active').length;
  const totalAppointments = appointments.length;
  const todaysAppointments = appointments.filter(a => a.appointment_date === today).length;
  const upcomingAppointments = appointments
    .filter(a => a.status === 'scheduled' && a.appointment_date >= today)
    .sort((a, b) => `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`))
    .slice(0, 5);

  if (patientsLoading || appointmentsLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <LoadingSkeleton key={i} className="h-32" />
          ))}
        </div>
        <LoadingSkeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center justify-center space-x-3">
          <Activity className="w-8 h-8 text-dental-blue" />
          <span>Dashboard Overview</span>
        </h1>
        <p className="text-dental-gray text-lg">Welcome back! Here's what's happening with your practice today.</p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Patients */}
        <Card className="border-l-4 border-l-dental-blue bg-gradient-to-br from-white to-dental-blue/5 hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-dental-gray">Total Patients</p>
                <p className="text-3xl font-bold text-dental-blue">{totalPatients}</p>
              </div>
              <div className="p-3 bg-dental-blue/10 rounded-full">
                <Users className="w-8 h-8 text-dental-blue" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card className="border-l-4 border-l-dental-mint bg-gradient-to-br from-white to-dental-mint/5 hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-dental-gray">Today's Appointments</p>
                <p className="text-3xl font-bold text-dental-mint">{todaysAppointments}</p>
              </div>
              <div className="p-3 bg-dental-mint/10 rounded-full">
                <Calendar className="w-8 h-8 text-dental-mint" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Patients */}
        <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-white to-green-50 hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-dental-gray">Active Patients</p>
                <p className="text-3xl font-bold text-green-600">{activePatients}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <UserCheck className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Appointments */}
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50 hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-dental-gray">Total Appointments</p>
                <p className="text-3xl font-bold text-blue-600">{totalAppointments}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <CalendarCheck className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-dental-blue/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-dental-blue to-dental-mint text-white">
          <CardTitle className="text-xl flex items-center space-x-2">
            <CheckCircle className="w-6 h-6" />
            <span>Quick Actions</span>
          </CardTitle>
          <CardDescription className="text-dental-blue-light">
            Commonly used functions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-24 flex flex-col space-y-3 hover:bg-dental-blue hover:text-white transition-all duration-200 border-dental-blue/20"
              onClick={() => onNavigate?.("patients")}
            >
              <Plus className="w-6 h-6" />
              <span className="text-sm font-medium">Add New Patient</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-24 flex flex-col space-y-3 hover:bg-dental-mint hover:text-white transition-all duration-200 border-dental-mint/20"
              onClick={() => onNavigate?.("appointments")}
            >
              <CalendarCheck className="w-6 h-6" />
              <span className="text-sm font-medium">Schedule Appointment</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-24 flex flex-col space-y-3 hover:bg-green-500 hover:text-white transition-all duration-200 border-green-200"
              onClick={() => onNavigate?.("reports")}
            >
              <FileBarChart className="w-6 h-6" />
              <span className="text-sm font-medium">Generate Report</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-24 flex flex-col space-y-3 hover:bg-blue-500 hover:text-white transition-all duration-200 border-blue-200"
              onClick={() => onNavigate?.("reports")}
            >
              <Eye className="w-6 h-6" />
              <span className="text-sm font-medium">View Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming appointments (real data; replaces a list of invented notifications) */}
      <Card className="border-dental-blue/20">
        <CardHeader>
          <CardTitle className="text-xl text-dental-blue flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Next Appointments</span>
          </CardTitle>
          <CardDescription>The next five scheduled visits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingAppointments.length === 0 ? (
            <p className="text-dental-gray">No upcoming appointments.</p>
          ) : (
            upcomingAppointments.map(appointment => (
              <div key={appointment.id} className="flex items-center space-x-3 p-3 bg-dental-blue-light/40 rounded-lg border-l-4 border-dental-blue">
                <CalendarCheck className="w-5 h-5 text-dental-blue" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{appointment.service_type} with {appointment.doctor}</p>
                  <p className="text-sm text-dental-gray">
                    {new Date(`${appointment.appointment_date}T${appointment.appointment_time}`).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;