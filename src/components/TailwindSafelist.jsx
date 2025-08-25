// This file is not meant to be used.
// It's a hack to make Tailwind's JIT compiler "see" the classes we generate dynamically.
const TailwindSafelist = () => {
  return (
    <div className="hidden">
      <strong className="font-bold text-white"></strong>
      <sup className="text-green-400 font-bold text-xs"></sup>
      <li className="ml-4 list-disc"></li>
    </div>
  );
};

export default TailwindSafelist;