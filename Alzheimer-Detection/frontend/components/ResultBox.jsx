export default function ResultBox({ result }) {
    return (
      <div className="result-box">
        <h2>Analysis Result</h2>
        <p>{result}</p>
      </div>
    );
  }