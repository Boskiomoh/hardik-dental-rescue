import { useNavigate } from "react-router-dom";
import LoginForm from "@/components/auth/LoginForm";

const SignUp = () => {
  const navigate = useNavigate();
  return <LoginForm defaultTab="signup" onLogin={() => navigate("/patient-dashboard")} />;
};

export default SignUp;
