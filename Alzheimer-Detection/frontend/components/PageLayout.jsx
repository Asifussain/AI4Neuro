import Navbar from './Navbar';
import styles from '../styles/PageLayout.module.css';

const PageLayout = ({ children }) => {
  return (
    <div className={styles.layoutContainer}>
      <Navbar />
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
};

export default PageLayout;
