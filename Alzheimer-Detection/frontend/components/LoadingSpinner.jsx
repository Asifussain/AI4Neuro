import React from 'react';
import styles from '../styles/CardioLoader.module.css'; 

export default function LoadingSpinner() {

  return (
    <svg
      className={styles.container} 
      x="0px"
      y="0px"
      viewBox="0 0 50 31.25"
      preserveAspectRatio='xMidYMid meet'
    >
      <path
        className={styles.track} 
        strokeWidth="4"
        fill="none"
        d="M0.625 21.5 h10.25 l3.75 -5.875 l7.375 15 l9.75 -30 l7.375 20.875 v0 h10.25"
      />
      <path
        className={styles.car} 
        strokeWidth="4"
        fill="none"
        pathLength="100" 
        d="M0.625 21.5 h10.25 l3.75 -5.875 l7.375 15 l9.75 -30 l7.375 20.875 v0 h10.25"
      />
    </svg>
  );
}
