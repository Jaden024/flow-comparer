import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./Comparison.css";

interface HarRequest {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  query_params: Record<string, string[]>;
  post_data?: string;
  response_status: number;
  response_headers: Record<string, string>;
  response_body?: string;
  index: number;
}

interface DetailedComparison {
  general: ComparisonSection;
  headers: ComparisonSection;
  params: ComparisonSection;
  body?: ComparisonSection;
  response: ComparisonSection;
}

interface ComparisonSection {
  content1: string;
  content2: string;
  differences: DiffLine[];
}

interface DiffLine {
  line_number: number;
  diff_type: string;
  content: string;
}

interface ComparisonData {
  detailed: DetailedComparison;
  req1: HarRequest;
  req2: HarRequest;
}

function Comparison() {
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComparisonData = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const dataId = urlParams.get('dataId');
        
        if (!dataId) {
          throw new Error('No data ID found in URL');
        }
        
        const storedData = await invoke<string | null>("get_comparison_data", { dataId });
        if (!storedData) {
          throw new Error('No comparison data found in storage');
        }
        
        const data: ComparisonData = JSON.parse(storedData);
        setComparisonData(data);
        setLoading(false);
        
      } catch (err) {
        console.error('Error loading comparison data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    loadComparisonData();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        Loading comparison data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        Error loading comparison data: {error}
      </div>
    );
  }

  if (!comparisonData) {
    return (
      <div className="error">
        No comparison data available
      </div>
    );
  }

  const { detailed, req1, req2 } = comparisonData;

  return (
    <div className="comparison-app">
      <div className="header">
        <h1>Detailed Comparison</h1>
        <p>
          Comparing: [{req1.index}] {req1.method} {req1.path} vs [{req2.index}] {req2.method} {req2.path}
        </p>
      </div>
      
      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </div>
        <div 
          className={`tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers
        </div>
        <div 
          className={`tab ${activeTab === 'params' ? 'active' : ''}`}
          onClick={() => setActiveTab('params')}
        >
          Parameters
        </div>
        {detailed.body && (
          <div 
            className={`tab ${activeTab === 'body' ? 'active' : ''}`}
            onClick={() => setActiveTab('body')}
          >
            Request Body
          </div>
        )}
        <div 
          className={`tab ${activeTab === 'response' ? 'active' : ''}`}
          onClick={() => setActiveTab('response')}
        >
          Response
        </div>
      </div>
      
      <div className="tab-content">
        {activeTab === 'general' && (
          <div className="comparison-panels">
            <div className="panel">
              <h4>File 1</h4>
              <pre>{detailed.general.content1}</pre>
            </div>
            <div className="panel">
              <h4>File 2</h4>
              <pre>{detailed.general.content2}</pre>
            </div>
          </div>
        )}
        
        {activeTab === 'headers' && (
          <div className="comparison-panels">
            <div className="panel">
              <h4>File 1 Headers</h4>
              <pre>{detailed.headers.content1}</pre>
            </div>
            <div className="panel">
              <h4>File 2 Headers</h4>
              <pre>{detailed.headers.content2}</pre>
            </div>
          </div>
        )}
        
        {activeTab === 'params' && (
          <div className="comparison-panels">
            <div className="panel">
              <h4>File 1 Parameters</h4>
              <pre>{detailed.params.content1}</pre>
            </div>
            <div className="panel">
              <h4>File 2 Parameters</h4>
              <pre>{detailed.params.content2}</pre>
            </div>
          </div>
        )}
        
        {activeTab === 'body' && detailed.body && (
          <div className="comparison-panels">
            <div className="panel">
              <h4>File 1 Request Body</h4>
              <pre>{detailed.body.content1}</pre>
            </div>
            <div className="panel">
              <h4>File 2 Request Body</h4>
              <pre>{detailed.body.content2}</pre>
            </div>
          </div>
        )}
        
        {activeTab === 'response' && (
          <div className="comparison-panels">
            <div className="panel">
              <h4>File 1 Response</h4>
              <pre>{detailed.response.content1}</pre>
            </div>
            <div className="panel">
              <h4>File 2 Response</h4>
              <pre>{detailed.response.content2}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Comparison;
