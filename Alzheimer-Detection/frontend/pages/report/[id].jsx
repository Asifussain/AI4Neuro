import { useRouter } from 'next/router';
import Navbar from '../../components/Navbar';
import ReportViewer from '../../components/ReportViewer';
import withAuth from '../../components/withAuth'; 
import { useAuth } from '../../components/AuthProvider';
import LoadingSpinner from '../../components/LoadingSpinner';
import styles from '../../styles/PageLayout.module.css';

function ReportDetailPage() {
  const router = useRouter();
  const { id: predictionId } = router.query; 
  const { profile, loading: authLoading } = useAuth(); 

  if (authLoading || !router.isReady) { 
      return (
           <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
              <LoadingSpinner />
           </div>
      );
  }

  if (!predictionId) {
       return (
           <>
               <Navbar />
               <div className={styles.pageContainer}>
                   <p>Invalid report ID.</p>
               </div>
           </>
       );
  }


  return (
    <>
      <Navbar />
      <div className={styles.pageContainer} style={{maxWidth: '1000px'}}> 
         <ReportViewer predictionId={predictionId} userRole={profile?.role} />
      </div>
    </>
  );
}

export default withAuth(ReportDetailPage);