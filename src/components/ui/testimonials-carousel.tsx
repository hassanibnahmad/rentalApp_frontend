import { useRef, useEffect, useState, type FC } from "react";
import { motion } from "framer-motion";

export interface Testimonial {
  text: string;
  highlight?: string;
  image: string;
  name: string;
  role: string;
}

interface TestimonialsCarouselProps {
  testimonials: Testimonial[];
  speed?: number; // Duration in seconds for one full scroll
  direction?: "left" | "right"; // Scroll direction
  cardHeight?: number; // Height of the testimonial card
  className?: string;
}

export const TestimonialsCarousel: FC<TestimonialsCarouselProps> = ({
  testimonials,
  speed = 20,
  direction = "left",
  cardHeight = 200,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setCarouselWidth(containerRef.current.scrollWidth / 2);
    }
  }, [testimonials]);

  const loopTestimonials = [...testimonials, ...testimonials];

  return (
    <div className={`overflow-hidden w-full ${className}`} ref={containerRef}>
      <motion.div
        animate={{
          x: direction === "left" ? [0, -carouselWidth] : [-carouselWidth, 0],
        }}
        transition={{
          duration: speed,
          repeat: Infinity,
          ease: "linear",
        }}
          className="flex gap-6"
      >
          {loopTestimonials.map(({ text, highlight, image, name, role }, index) => (
          <motion.div
            key={`${name}-${index}`}
            whileHover={{ scale: 1.05, rotate: 1 }}
              className="bg-[#050915] border border-white/10 text-slate-200 my-3 shadow-[0_25px_60px_rgba(2,6,23,0.65)] rounded-3xl p-5 flex-shrink-0 w-[360px]"
            style={{ height: cardHeight }}
          >
              <p className="text-[15px] leading-relaxed text-slate-200 text-left">
              {highlight
                ? text.split(highlight).map((part, idx, arr) => (
                    <span key={`${highlight}-${idx}`}>
                      {part}
                        {idx !== arr.length - 1 && <span className="text-primary font-semibold">{highlight}</span>}
                    </span>
                  ))
                : text}
            </p>

            <div className="flex items-center gap-3 mt-5">
              <img
                src={image}
                alt={name}
                width={50}
                height={50}
                className="h-12 w-12 rounded-full object-cover"
              />
              <div className="flex flex-col">
                  <span className="font-semibold leading-tight text-white">{name}</span>
                  <span className="text-xs text-slate-400">{role}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
