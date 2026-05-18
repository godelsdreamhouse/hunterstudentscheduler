import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import backgroundImg from "../../assets/campus-background.png";
import logoImg from "../../assets/watchtower-logo.svg";

export function Landing() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-white/70" />

      <div className="relative w-full max-w-4xl bg-white/70 rounded-3xl shadow-xl py-10 px-8 md:py-12 md:px-12 flex flex-col">

        <div className="flex items-center justify-center mb-5">
          <button onClick={() => navigate("/dashboard")} className="cursor-pointer">
            <img src={logoImg} alt="Watchtower Logo" className="h-16 w-auto" />
          </button>
        </div>

        <p
          className="text-base md:text-lg text-gray-700 max-w-2xl mx-auto font-medium text-center mb-8"
          style={{ lineHeight: "1.75" }}
        >
          Hunter College student? Upload your DegreeWorks and build your class schedule to graduation.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[
            {
              n: 1,
              title: "Upload Your DegreeWorks PDF",
              body: "We extract your requirements and academic progress automatically.",
            },
            {
              n: 2,
              title: "Build Your Schedule",
              body: "See what classes you need and plan semester by semester.",
            },
            {
              n: 3,
              title: "Stay on Track to Graduate",
              body: "Track prerequisites, avoid mistakes and plan ahead with confidence.",
            },
          ].map(({ n, title, body }) => (
            <div key={n} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-indigo-900 text-white rounded-full flex items-center justify-center text-base font-bold mb-3 flex-shrink-0">
                {n}
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-2 leading-snug">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 text-white px-10 py-4 text-base rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Get Started
          </Button>
        </div>

      </div>
    </div>
  );
}
