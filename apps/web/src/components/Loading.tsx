export default function LoadingDots() {
  return (
    <>
      <style>{`
        @keyframes dot {
          0%, 20% { opacity: 0; }
          40% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      <div className="flex items-center justify-center">
        <span>Loading</span>
        <span className="animate-[dot_1.1s_ease-in-out_0s_infinite]">.</span>
        <span className="animate-[dot_1.1s_ease-in-out_0.1s_infinite]">.</span>
        <span className="animate-[dot_1.1s_ease-in-out_0.2s_infinite]">.</span>
      </div>
    </>
  );
}
