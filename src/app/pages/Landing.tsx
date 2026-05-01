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

      <div className="relative w-full max-w-4xl bg-white/80 rounded-3xl shadow-xl py-16 px-12 md:py-20 md:px-16 flex flex-col">

        <div className="flex items-center justify-center mb-8">
          <img src={logoImg} alt="Watchtower Logo" className="h-24 w-auto" />
        </div>

        <p
          className="text-xl md:text-2xl text-gray-700 max-w-2xl mx-auto font-medium text-center mb-14"
          style={{ lineHeight: "1.75" }}
        >
          Hunter College student? Upload your DegreeWorks and build your class schedule to graduation.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-14">
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
              <div className="w-16 h-16 bg-indigo-900 text-white rounded-full flex items-center justify-center text-xl font-bold mb-5 flex-shrink-0">
                {n}
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-3 leading-snug">{title}</h3>
              <p className="text-base text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 text-white px-14 py-7 text-lg rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Get Started
          </Button>
        </div>

      </div>
    </div>
  );
}
