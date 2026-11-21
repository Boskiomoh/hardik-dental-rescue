import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ValidatedInput } from "@/components/ui/validated-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, Phone, Mail, MessageSquare, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import QuickInfoCard from "@/components/common/QuickInfoCard";
import { clinic } from "@/config/clinic";

const toLocalIsoDate = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
};

const emptyForm = {
  firstName: { value: '', isValid: false },
  lastName: { value: '', isValid: false },
  email: { value: '', isValid: false },
  phone: { value: '', isValid: false },
  date: '',
  time: '',
  service: '',
  doctor: '',
  message: ''
};

const DentalBooking = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [formData, setFormData] = useState(emptyForm);
  const { toast } = useToast();
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const today = toLocalIsoDate(new Date());

  // Doctors and services come from the database, so the form only offers
  // what the clinic actually has
  useEffect(() => {
    const fetchOptions = async () => {
      const [doctorsResult, servicesResult] = await Promise.all([
        supabase.from('doctors').select('name').eq('is_active', true).order('name'),
        supabase.from('services').select('name').order('name'),
      ]);
      if (doctorsResult.error || servicesResult.error) {
        toast({
          title: "Couldn't load the booking options",
          description: "Please refresh the page, or call us to book.",
          variant: "destructive"
        });
        return;
      }
      setDoctors(doctorsResult.data.map((doctor) => doctor.name));
      setServices(servicesResult.data.map((service) => service.name));
    };

    fetchOptions();
  }, [toast]);

  // Fetch booked time slots for the selected date and doctor. The function
  // returns times only, never who booked them.
  const fetchBookedSlots = async (date: string, doctor: string) => {
    if (!date || !doctor) {
      setBookedSlots([]);
      return;
    }

    setLoadingSlots(true);
    setSlotsError(false);
    const { data, error } = await supabase.rpc('get_booked_slots', { p_date: date, p_doctor: doctor });
    if (error) {
      setSlotsError(true);
      setBookedSlots([]);
    } else {
      setBookedSlots(data ?? []);
    }
    setLoadingSlots(false);
  };

  useEffect(() => {
    fetchBookedSlots(formData.date, formData.doctor);
  }, [formData.date, formData.doctor]);

  const updateFormField = (field: string, value: string, isValid: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: { value, isValid }
    }));
  };

  const updateFormValue = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const requiredFieldsValid = formData.firstName.isValid && 
                               formData.lastName.isValid && 
                               formData.email.isValid && 
                               formData.phone.isValid &&
                               formData.date && 
                               formData.time && 
                               formData.service &&
                               formData.doctor;

    if (!requiredFieldsValid) {
      toast({
        title: "Please complete all required fields",
        description: "Make sure all required fields are filled out correctly.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    // book_appointment saves the patient and the appointment in one step,
    // without giving visitors read access to patient records
    const { error } = await supabase.rpc('book_appointment', {
      p_first_name: formData.firstName.value,
      p_last_name: formData.lastName.value,
      p_email: formData.email.value,
      p_phone: formData.phone.value,
      p_date: formData.date,
      p_time: formData.time,
      p_service: formData.service,
      p_doctor: formData.doctor,
      p_notes: formData.message,
    });
    setIsSubmitting(false);

    if (error) {
      // Messages raised by book_appointment are written for patients;
      // anything else is a technical error and stays out of the UI
      const isClinicMessage = error.code === '22023' || error.code === 'P0001';
      toast({
        title: "Booking Failed",
        description: isClinicMessage
          ? error.message
          : `Something went wrong on our side. Please try again, or call us on ${clinic.phone}.`,
        variant: "destructive"
      });
      if (error.hint === 'slot_taken') {
        updateFormValue('time', '');
        fetchBookedSlots(formData.date, formData.doctor);
      }
      return;
    }

    setIsSubmitted(true);
    toast({
      title: "Appointment Request Submitted!",
      description: "We'll contact you within 24 hours to confirm your appointment.",
    });
  };

  const timeSlots = Array.from({ length: 17 }, (_, i) => {
    const totalMinutes = 9 * 60 + i * 30; // 09:00 to 17:00 in 30-min steps
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    const labelHours = ((hours + 11) % 12) + 1; // 0->12, 13->1, etc.
    const ampm = hours < 12 ? 'AM' : 'PM';
    const label = `${labelHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
    return { value, label };
  });

  const bookingInfoItems = [
    { text: "All fields with * are required for processing", icon: "alert" as const },
    { text: "Appointments can be booked from today, Monday to Saturday", icon: "clock" as const },
    { text: "Times already taken with your chosen doctor are greyed out", icon: "users" as const },
    { text: "Our team will call or email you to confirm", icon: "check" as const }
  ];

  if (isSubmitted) {
    return (
      <section className="py-20 bg-gradient-to-br from-dental-blue-light via-white to-dental-mint-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="shadow-dental-card border-dental-blue-light animate-scale-in">
            <CardContent className="text-center p-12">
              <div className="w-20 h-20 bg-success rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-4 font-inter">
                Appointment Request Received!
              </h3>
              <p className="text-dental-gray mb-8 text-lg">
                Thank you for choosing {clinic.name}. Our team will contact you within 24 hours to confirm your appointment details.
              </p>
              <div className="grid md:grid-cols-2 gap-4 text-left bg-dental-blue-light rounded-xl p-6">
                <div>
                  <h4 className="font-semibold text-dental-blue mb-2">What's Next?</h4>
                  <ul className="space-y-1 text-dental-gray">
                    <li>• We'll call or email you to confirm</li>
                    <li>• Bring your insurance card, if you have one</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-dental-blue mb-2">Need Immediate Help?</h4>
                  <ul className="space-y-1 text-dental-gray">
                    <li>• Call: {clinic.phone}</li>
                    <li>• Emergency: {clinic.emergencyPhone}</li>
                    <li>• Email: {clinic.email}</li>
                  </ul>
                </div>
              </div>
              <Button 
                variant="dental" 
                size="lg" 
                className="mt-8 font-inter"
                onClick={() => {
                  // The inputs remount empty, so the saved values must be cleared too
                  setFormData(emptyForm);
                  setBookedSlots([]);
                  setIsSubmitted(false);
                }}
              >
                Book Another Appointment
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-gradient-to-br from-dental-blue-light via-white to-dental-mint-light">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 font-inter">
            Book Your 
            <span className="bg-gradient-to-r from-dental-blue to-dental-mint bg-clip-text text-transparent"> Appointment</span>
          </h2>
          <p className="text-lg text-dental-gray max-w-2xl mx-auto">
            Schedule your visit with our expert dental team. We offer flexible scheduling 
            to accommodate your busy lifestyle.
          </p>
        </div>

        {/* Quick Info Card */}
        <div className="max-w-2xl mx-auto mb-8">
          <QuickInfoCard 
            title="Appointment Guidelines" 
            items={bookingInfoItems}
          />
        </div>

        <Card className="shadow-dental-card border-dental-blue-light animate-scale-in">
          <CardHeader className="text-center bg-gradient-to-r from-dental-blue to-dental-mint text-white rounded-t-lg">
            <CardTitle className="text-2xl font-bold font-inter flex items-center justify-center space-x-2">
              <Calendar className="w-6 h-6" />
              <span>Schedule Your Visit</span>
            </CardTitle>
            <CardDescription className="text-dental-blue-light">
              Fill out the form below and we'll contact you to confirm your appointment
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="grid md:grid-cols-2 gap-6">
                <ValidatedInput
                  id="firstName"
                  label="First Name"
                  placeholder="Enter your first name"
                  validation={{ type: 'name', required: true, minLength: 2 }}
                  onValueChange={(value, isValid) => updateFormField('firstName', value, isValid)}
                  className="border-dental-blue-light focus:border-dental-blue"
                />
                <ValidatedInput
                  id="lastName"
                  label="Last Name"
                  placeholder="Enter your last name"
                  validation={{ type: 'name', required: true, minLength: 2 }}
                  onValueChange={(value, isValid) => updateFormField('lastName', value, isValid)}
                  className="border-dental-blue-light focus:border-dental-blue"
                />
              </div>

              {/* Contact Information */}
              <div className="grid md:grid-cols-2 gap-6">
                <ValidatedInput
                  id="email"
                  label="Email"
                  type="email"
                  placeholder="your.email@example.com"
                  validation={{ type: 'email', required: true }}
                  onValueChange={(value, isValid) => updateFormField('email', value, isValid)}
                  className="border-dental-blue-light focus:border-dental-blue"
                />
                <ValidatedInput
                  id="phone"
                  label="Phone Number"
                  type="tel"
                  autoComplete="tel"
                  placeholder="(555) 010-1234"
                  validation={{ type: 'phone', required: true, minLength: 7 }}
                  onValueChange={(value, isValid) => updateFormField('phone', value, isValid)}
                  className="border-dental-blue-light focus:border-dental-blue"
                />
              </div>

              {/* Appointment Details */}
              <div className="grid md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-dental-blue font-medium flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Preferred Date</span>
                  </Label>
                  <ValidatedInput
                    id="date"
                    type="date"
                    min={today}
                    validation={{ type: 'text', required: true }}
                    onValueChange={(value) => {
                      // ValidatedInput calls this after every render, so only
                      // clear the chosen time when the date really changed
                      setFormData(prev => prev.date === value ? prev : { ...prev, date: value, time: '' });
                    }}
                    className="border-dental-blue-light focus:border-dental-blue"
                    showValidationIcons={false}
                  />
                  {formData.date && new Date(`${formData.date}T00:00`).getDay() === 0 && (
                    <p className="text-xs text-destructive">We're closed on Sundays. Please pick another day.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time" className="text-dental-blue font-medium flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>Preferred Time</span>
                    {loadingSlots && <span className="text-xs text-muted-foreground">(Loading...)</span>}
                  </Label>
                  <Select
                    required
                    value={formData.time}
                    onValueChange={(value) => updateFormValue('time', value)}
                    disabled={!formData.date || !formData.doctor || loadingSlots}
                  >
                    <SelectTrigger id="time" className="border-dental-blue-light focus:border-dental-blue">
                      <SelectValue placeholder={!formData.date || !formData.doctor ? "Select date & doctor first" : "Select time"} />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((t) => {
                        const isBooked = bookedSlots.includes(t.value);
                        return (
                          <SelectItem 
                            key={t.value} 
                            value={t.value}
                            disabled={isBooked}
                            className={isBooked ? 'text-muted-foreground line-through' : ''}
                          >
                            {t.label} {isBooked && '(Booked)'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {slotsError && (
                    <p className="text-xs text-destructive">
                      Couldn't check which times are free. You can still send the request.
                    </p>
                  )}
                  {formData.date && formData.doctor && bookedSlots.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {bookedSlots.length} slot(s) already booked for this date with {formData.doctor}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service" className="text-dental-blue font-medium">
                    Service Needed
                  </Label>
                  <Select required onValueChange={(value) => updateFormValue('service', value)}>
                    <SelectTrigger id="service" className="border-dental-blue-light focus:border-dental-blue">
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service} value={service}>
                          {service}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doctor" className="text-dental-blue font-medium">
                    Preferred Doctor
                  </Label>
                  <Select required onValueChange={(value) => {
                    updateFormValue('doctor', value);
                    // Reset time when doctor changes as slots may differ
                    updateFormValue('time', '');
                  }}>
                    <SelectTrigger id="doctor" className="border-dental-blue-light focus:border-dental-blue">
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor} value={doctor}>
                          {doctor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-2">
                <Label htmlFor="message" className="text-dental-blue font-medium flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>Additional Information (Optional)</span>
                </Label>
                <Textarea 
                  id="message" 
                  className="border-dental-blue-light focus:border-dental-blue"
                  placeholder="Please let us know if you have any specific concerns, preferences, or if this is your first visit..."
                  rows={4}
                  onChange={(e) => updateFormValue('message', e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <div className="text-center pt-6">
                <Button type="submit" variant="dental" size="xl" className="font-inter w-full md:w-auto" disabled={isSubmitting}>
                  <Calendar className="w-5 h-5" />
                  {isSubmitting ? "Sending request..." : "Request Appointment"}
                </Button>
                <p className="text-sm text-dental-gray mt-4">
                  We'll contact you within 24 hours to confirm your appointment
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card className="text-center border-dental-blue-light">
            <CardContent className="p-6">
              <Phone className="w-8 h-8 text-dental-blue mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-2">Call Us</h4>
              <p className="text-dental-gray">{clinic.phone}</p>
            </CardContent>
          </Card>
          <Card className="text-center border-dental-blue-light">
            <CardContent className="p-6">
              <Mail className="w-8 h-8 text-dental-mint mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-2">Email Us</h4>
              <p className="text-dental-gray">{clinic.email}</p>
            </CardContent>
          </Card>
          <Card className="text-center border-dental-blue-light">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-dental-blue mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-2">Hours</h4>
              <p className="text-dental-gray">{clinic.hours[0]}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default DentalBooking;