import React, { useState, useEffect } from 'react';
import './ImageCarousel.css';

const images = [
  "https://media.licdn.com/dms/image/v2/D5622AQGKWNsXq-p_ew/feedshare-shrink_2048_1536/0/1712745353292?e=1725494400&v=beta&t=jYFBQIbXthr4GOoA3JDoIlXEK8cbDR5xPgyHNofCz18",
  "https://media.licdn.com/dms/image/v2/D5622AQFZTVBaBCpREw/feedshare-shrink_2048_1536/0/1715056801835?e=1725494400&v=beta&t=i35CvLwlhB1lnc5Wn8RJeHUaM9utR-UQkHkpGYbzFLE",
  "https://media.licdn.com/dms/image/v2/D5622AQFdvlZGi-2lWg/feedshare-shrink_2048_1536/0/1714392002013?e=1725494400&v=beta&t=X6bJsoEfjr7xM_T4c9_542hLlGw93gTSIu5W4FfpkCg",
  "https://media.licdn.com/dms/image/v2/D5622AQH0l6rWMv_Zvw/feedshare-shrink_2048_1536/0/1719548402011?e=1725494400&v=beta&t=ssVU8Cp9LW5-VCPSvY_j8YsV56EDsnXG6TOuGBKKgKM",
  "https://media.licdn.com/dms/image/v2/D5622AQH3CQ3aX-y_yA/feedshare-shrink_2048_1536/0/1719484801908?e=1725494400&v=beta&t=rEMeq8HqBZ9Hb89Y3I5B8hHGTMh49Ra5ZKiQOe47144",
  "https://media.licdn.com/dms/image/v2/D5622AQEYwj4323KzLA/feedshare-shrink_2048_1536/0/1718879998103?e=1725494400&v=beta&t=UWgFyoaCo8mzgeZpccc5VjywkZc6I_sXZuh5A22T9EE",
  "https://media.licdn.com/dms/image/v2/D5622AQHdc65Ws-nCnw/feedshare-shrink_2048_1536/0/1718262001099?e=1725494400&v=beta&t=psL47zWCF14BCzlSVKpWqa9y4rjgAivVCee6ee-Mzv4",
  "https://media.licdn.com/dms/image/v2/D5622AQEr6Nc6T0HqCg/feedshare-shrink_2048_1536/0/1718188801449?e=1725494400&v=beta&t=cjMVM-zacrqt2hzFRmF2sMM_gDLXNh0lh_xjykTsk3I",
  "httpshttps://media.licdn.com/dms/image/v2/D5622AQF0w-sd89FjCg/feedshare-shrink_2048_1536/0/1718103601831?e=1725494400&v=beta&t=gF2CSZvdstrpt9HYaAzWNEXPIXQ17RdZhmXVtAEmiPk",
  "https://media.licdn.com/dms/image/v2/D5622AQGyxNt9-T1aAw/feedshare-shrink_2048_1536/0/1717675202119?e=1725494400&v=beta&t=rcpUMGFfAy6ml-BqV8rlOBRPVy27ghl059B3YVBz8sE",
  "https://media.licdn.com/dms/image/v2/D5622AQFfN-n9q-M22Q/feedshare-shrink_2048_1536/0/1717592401490?e=1725494400&v=beta&t=bujZJl-p5W6byQh-pM2rIQa_4WuTHixFZWvSwoy0qHU"
];

const ImageCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      {images.map((image, index) => (
        <img
          key={index}
          src={image}
          alt={`carousel-${index}`}
          className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  );
};

export default ImageCarousel;
