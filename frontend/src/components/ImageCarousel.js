import React from 'react';
import './ImageCarousel.css';

import image1 from '../assets/carousel/1760922234178.jpg';
import image2 from '../assets/carousel/1760922234926.jpg';
import image3 from '../assets/carousel/1760922234968.jpg';
import image4 from '../assets/carousel/1760922235049.jpg';
import image5 from '../assets/carousel/1760922235281.jpg';
import image6 from '../assets/carousel/1760922235358.jpg';
import image7 from '../assets/carousel/1760922235406.jpg';
import image8 from '../assets/carousel/1760922235497.jpg';
import image9 from '../assets/carousel/1760922235534.jpg';
import image10 from '../assets/carousel/1760922235603.jpg';
import image11 from '../assets/carousel/1760922235760.jpg';
import image12 from '../assets/carousel/1760922235776.jpg';
import image13 from '../assets/carousel/1760922236111.jpg';

const images = [
  image1,
  image2,
  image3,
  image4,
  image5,
  image6,
  image7,
  image8,
  image9,
  image10,
  image11,
  image12,
  image13
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
    <div className="w-full max-w-2xl aspect-video overflow-hidden rounded-2xl shadow-lg">
      <div className="w-full h-full relative">
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            alt={`carousel-${index}`}
            className={`absolute w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ImageCarousel;
