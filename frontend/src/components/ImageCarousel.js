import React from 'react';
import './ImageCarousel.css';

import image1 from '../assets/carousel/carousel-1.jpg';
import image2 from '../assets/carousel/carousel-2.jpg';
import image3 from '../assets/carousel/carousel-3.jpg';
import image4 from '../assets/carousel/carousel-4.jpg';
import image5 from '../assets/carousel/carousel-5.jpg';
import image6 from '../assets/carousel/carousel-6.jpg';
import image7 from '../assets/carousel/carousel-7.jpg';
import image8 from '../assets/carousel/carousel-8.jpg';
import image9 from '../assets/carousel/carousel-9.jpg';
import image10 from '../assets/carousel/carousel-10.jpg';
import image11 from '../assets/carousel/carousel-11.jpg';

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
  image11
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
