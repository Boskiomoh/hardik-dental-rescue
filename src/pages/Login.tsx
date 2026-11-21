import { useNavigate } from "react-router-dom";
import LoginForm from "@/components/auth/LoginForm";

const Login = () => {
  const navigate = useNavigate();
  return <LoginForm onLogin={() => navigate("/patient-dashboard")} />;
};

export default Login;
