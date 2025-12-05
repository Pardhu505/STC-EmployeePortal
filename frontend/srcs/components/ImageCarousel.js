import React from 'react';
import './ImageCarousel.css';

const images = [
  "https://picsum.photos/1200/800?random=1",
  "https://picsum.photos/1200/800?random=2",
  "https://picsum.photos/1200/800?random=3",
  "https://picsum.photos/1200/800?random=4",
  "https://picsum.photos/1200/800?random=5",
  "https://picsum.photos/1200/800?random=6",
  "https://picsum.photos/1200/800?random=7",
  "https://picsum.photos/1200/800?random=8",
  "https://picsum.photos/1200/800?random=9",
  "https://picsum.photos/1200/800?random=10",
  "https://picsum.photos/1200/800?random=11"
];

const ImageCarousel = () => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-1/2 h-screen overflow-hidden relative">
      {images.map((src, index) => (
        <img
          key={index}
          src={src}
          alt={`carousel-${index}`}
          className={`absolute w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
    </div>
  );
};

export default ImageCarousel;
