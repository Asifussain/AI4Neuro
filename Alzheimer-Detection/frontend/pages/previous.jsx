import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import supabase from '../lib/supabaseClient';
import { useUser } from '../components/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import Link from 'next/link';
import styles from '../styles/PreviousUploads.module.css';

const ITEMS_PER_PAGE = 5;

export default function PreviousUploads() {
  const { user } = useUser();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const fetchPredictions = async () => {
      if (!user) {
        setLoading(false);
        setPredictions([]);
        setTotalCount(0);
        return;
      }
      setError(null);

      if (!isFiltering) setLoading(true);

      const rangeFrom = (currentPage - 1) * ITEMS_PER_PAGE;
      const rangeTo = rangeFrom + ITEMS_PER_PAGE - 1;
      try {
        let query = supabase
          .from('predictions')
          .select('id, filename, prediction, created_at', { count: 'exact' })
          .eq('user_id', user.id);

        if (startDate) {
          query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
          query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
        }

        query = query.order('created_at', { ascending: false })
                     .range(rangeFrom, rangeTo);

        const { data, error: dbError, count } = await query;

        if (dbError) throw dbError;

        setPredictions(data || []);
        setTotalCount(count || 0);

      } catch (err) {
        console.error("Error fetching predictions:", err);
        setError("Failed to load previous predictions. Please try again later.");
        setPredictions([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
        setIsFiltering(false);
      }
  };

  useEffect(() => {
    fetchPredictions();
  }, [user, currentPage, startDate, endDate]);

  const handleClearFilters = () => {
      setIsFiltering(true);
      setStartDate('');
      setEndDate('');
      setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const formatTimestamp = (timestamp) => {
      if (!timestamp) return 'N/A';
      try {
          return new Date(timestamp).toLocaleString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
          });
      } catch (e) { return timestamp; }
  };

  return (
    <>
      <Navbar />
      <div className={styles.pageContainer}>
        <h1 className={styles.pageTitle}>Previous Predictions</h1>
        <div className={styles.mainContentLayout}>
          <div className={styles.historyColumn}>
            {loading && (
              <div className={`${styles.stateContainer} ${styles.loadingContainer}`}>
                <LoadingSpinner />
                <span>Loading history...</span>
              </div>
            )}
            {error && !loading && (
              <div className={`${styles.stateContainer} ${styles.errorContainer}`}>
                <p>{error}</p>
              </div>
            )}
            {!user && !loading && !error && (
                 <div className={styles.stateContainer}>
                    <p>Please log in to view your prediction history.</p>
                 </div>
            )}
            {!loading && !error && user && (
              <>
                 {predictions.length > 0 ? (
                    <>
                        <div className={styles.predictionsTableWrapper}>
                          <table className={styles.predictionsTable}>
                            <thead>
                              <tr>
                                <th>Filename</th>
                                <th>Prediction</th>
                                <th>Date Analyzed</th>
                                <th>Report</th>
                              </tr>
                            </thead>
                            <tbody>
                              {predictions.map((p) => (
                                <tr key={p.id}>
                                  <td>{p.filename}</td>
                                  <td className={p.prediction === "Alzheimer's" ? styles.predictionCellAlzheimer : styles.predictionCellNormal}>
                                    {p.prediction}
                                  </td>
                                  <td className={styles.dateCell}>
                                    {formatTimestamp(p.created_at)}
                                  </td>
                                  <td>
                                     <Link
                                         href={`/report/${p.id}`}
                                         className={styles.reportLinkButton}
                                     >
                                         View Report
                                     </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {totalPages > 1 && (
                            <div className={styles.paginationContainer}>
                                <button
                                    onClick={handlePreviousPage}
                                    disabled={currentPage === 1 || loading || isFiltering}
                                    className={styles.paginationButton}
                                >
                                    Previous
                                </button>
                                <span className={styles.pageInfo}>
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages || loading || isFiltering}
                                    className={styles.paginationButton}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                 ) : (
                     <div className={styles.stateContainer}>
                        <p>{(startDate || endDate) ? "No predictions found for the selected date range." : "You haven't analyzed any files yet."}</p>
                     </div>
                 )}
              </>
            )}
          </div>
          <div className={styles.filterColumn}>
            {user && (
                 <div className={styles.filterContainer}>
                    <h3 style={{marginBottom:'1rem', fontWeight: 500, color:'#eee'}}>Filter by Date</h3>
                    <div className={styles.filterGroup}>
                        <label htmlFor="startDate" className={styles.filterLabel}>From:</label>
                        <input
                            type="date"
                            id="startDate"
                            className={styles.dateInput}
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); setIsFiltering(true);}}
                            max={endDate || undefined}
                            disabled={loading || isFiltering}
                        />
                    </div>
                    <div className={styles.filterGroup}>
                        <label htmlFor="endDate" className={styles.filterLabel}>To:</label>
                        <input
                            type="date"
                            id="endDate"
                            className={styles.dateInput}
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); setIsFiltering(true); }}
                            min={startDate || undefined}
                            disabled={loading || isFiltering}
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button
                            onClick={handleClearFilters}
                            className={styles.filterButton}
                            disabled={loading || isFiltering}
                        >
                            {isFiltering ? 'Clearing...' : 'Clear Filters'}
                        </button>
                    )}
                 </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
