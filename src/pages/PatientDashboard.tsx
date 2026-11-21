import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import PatientDashboard from "@/components/auth/PatientDashboard";

const PatientDashboardPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoaded(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoaded(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoaded && !user) {
      navigate("/login");
    }
  }, [isLoaded, user, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-background font-inter flex items-center justify-center">
        <div className="text-dental-blue">Loading...</div>
      </div>
    );
  }

  return <PatientDashboard user={user} onLogout={handleLogout} />;
};

export default PatientDashboardPage;
