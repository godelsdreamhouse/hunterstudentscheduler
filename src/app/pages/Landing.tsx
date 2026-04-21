import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { GraduationCap } from "lucide-react";
import backgroundImg from "../../assets/b3d452bf12523fa72eb64d2315103a37f4afe3ea.png";
import logoImg from "../../assets/9b3d587c8bb8091232b3d2c8640647d3ca857481.png";

export function Landing() {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-gray-50 relative"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-white/70" />
      
      <div className="relative w-full max-w-4xl">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-4 md:p-6">
          {/* Logo and Title */}
          <div className="text-center mb-2">
            <div className="flex items-center justify-center">
              <img src={logoImg} alt="Watchtower Logo" className="h-[416px] w-auto" />
            </div>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              Hunter College student? Upload your DegreeWorks and build your class schedule to graduation.
            </p>
          </div>

          {/* Three Steps */}
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            {/* Step 1 */}
            <div className="text-center">
              <div className="mx-auto w-14 h-14 bg-indigo-900 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                1
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Upload Your DegreeWorks PDF</h3>
              <p className="text-sm text-gray-600">
                We extract your requirements and academic progress automatically.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="mx-auto w-14 h-14 bg-indigo-900 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                2
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Build Your Schedule</h3>
              <p className="text-sm text-gray-600">
                See what classes you need and plan semester by semester.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="mx-auto w-14 h-14 bg-indigo-900 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                3
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Stay on Track to Graduate</h3>
              <p className="text-sm text-gray-600">
                Track prerequisites, avoid mistakes and plan ahead with confidence.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Button
              size="lg"
              onClick={() => navigate("/login")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-6 text-lg rounded-xl"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}