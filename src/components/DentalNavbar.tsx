import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Calendar, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { clinic } from "@/config/clinic";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DentalNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const services = [
    "General Dentistry",
    "Cosmetic Dentistry", 
    "Orthodontics",
    "Oral Surgery",
    "Emergency Care",
    "Pediatric Dentistry"
  ];

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services", hasDropdown: true },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/feedback", label: "Feedback" }
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-md z-50 border-b border-border shadow-dental-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center gap-4 h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-r from-dental-blue to-dental-mint rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <span className="text-xl font-bold text-dental-blue font-inter whitespace-nowrap">{clinic.name}</span>
          </Link>

          {/* Desktop Navigation (lg and up, so the buttons always fit) */}
          <div className="hidden lg:flex items-center space-x-3 xl:space-x-6">
            {navLinks.map(link => (
              link.hasDropdown ? (
                <DropdownMenu key={link.label}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="text-dental-gray hover:text-dental-blue transition-colors duration-300 font-medium">
                      {link.label}
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-background z-50">
                    <DropdownMenuItem asChild>
                      <Link to="/services" className="w-full">
                        All Services
                      </Link>
                    </DropdownMenuItem>
                    {services.map(service => (
                      <DropdownMenuItem key={service} asChild>
                        <Link to="/services" className="w-full">
                          {service}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link 
                  key={link.label} 
                  to={link.href} 
                  className="text-dental-gray hover:text-dental-blue transition-colors duration-300 font-medium"
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-3">
            <Button 
              asChild
              variant="ghost" 
              className="hidden xl:flex items-center space-x-2 text-dental-gray hover:text-dental-blue transition-colors duration-300" 
            >
              <a href={clinic.phoneHref}>
                <Phone className="w-4 h-4" />
                <span className="font-medium">{clinic.phone}</span>
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="font-inter">
              <Link to="/login">Patient Login</Link>
            </Button>
            <Button asChild variant="dental" size="lg" className="font-inter px-5 xl:px-8">
              <Link to="/booking">
                <Calendar className="w-4 h-4" />
                Book Appointment
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="text-dental-blue"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div id="mobile-menu" className="lg:hidden animate-fade-in">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-background border-t border-border">
              {navLinks.map(link => (
                <div key={link.label}>
                  <Link 
                    to={link.href} 
                    className="block px-3 py-2 text-muted-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-300" 
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                  {link.hasDropdown && (
                    <div className="pl-6 space-y-1">
                      {services.map(service => (
                        <Link
                          key={service}
                          to="/services"
                          className="block px-3 py-1 text-sm text-muted-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-300"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {service}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="pt-4 border-t border-border">
                <Button 
                  asChild
                  variant="ghost" 
                  className="flex items-center justify-start space-x-2 px-3 py-2 text-muted-foreground hover:text-primary transition-colors duration-300" 
                >
                  <a href={clinic.phoneHref} onClick={() => setIsMenuOpen(false)}>
                    <Phone className="w-4 h-4" />
                    <span>{clinic.phone}</span>
                  </a>
                </Button>
                <div className="px-3 py-2 space-y-2">
                  <Button asChild variant="outline" size="sm" className="w-full font-inter">
                    <Link to="/login" onClick={() => setIsMenuOpen(false)}>Patient Login</Link>
                  </Button>
                  <Button asChild variant="dental" size="lg" className="w-full font-inter">
                    <Link to="/booking" onClick={() => setIsMenuOpen(false)}>
                      <Calendar className="w-4 h-4" />
                      Book Appointment
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default DentalNavbar;