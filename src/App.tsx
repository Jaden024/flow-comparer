import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactDiffViewer from 'react-diff-viewer-continued';
import "./App.css";

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

interface HarFile {
  requests: HarRequest[];
  file_path: string;
}

interface ComparisonResult {
  status: string;
  details: string;
}

interface AlignedPair {
  index1?: number;
  index2?: number;
  comparison?: ComparisonResult;
}

interface DetailedComparison {
  general: ComparisonSection;
  raw_request: ComparisonSection;
  headers: ComparisonSection;
  payloads?: ComparisonSection;
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

function App() {
  const [harFile1, setHarFile1] = useState<HarFile | null>(null);
  const [harFile2, setHarFile2] = useState<HarFile | null>(null);
  const [alignedPairs, setAlignedPairs] = useState<AlignedPair[]>([]);
  const [keysOnly, setKeysOnly] = useState(false);
  const [alignRequests, setAlignRequests] = useState(false);
  const [syncScroll, setSyncScroll] = useState(false);
  const [autoSelect, setAutoSelect] = useState(false);
  const [selectedRequest1, setSelectedRequest1] = useState<HarRequest | null>(null);
  const [selectedRequest2, setSelectedRequest2] = useState<HarRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetailedComparison, setShowDetailedComparison] = useState(false);
  const [detailedComparisonData, setDetailedComparisonData] = useState<DetailedComparison | null>(null);

  // Refs for synchronized scrolling
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Synchronized scrolling handlers
  const handleLeftScroll = useCallback(() => {
    if (!syncScroll || !alignRequests || isScrollingRef.current) return;

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;

    if (leftPanel && rightPanel) {
      isScrollingRef.current = true;
      rightPanel.scrollTop = leftPanel.scrollTop;
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 10);
    }
  }, [syncScroll, alignRequests]);

  const handleRightScroll = useCallback(() => {
    if (!syncScroll || !alignRequests || isScrollingRef.current) return;

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;

    if (leftPanel && rightPanel) {
      isScrollingRef.current = true;
      leftPanel.scrollTop = rightPanel.scrollTop;
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 10);
    }
  }, [syncScroll, alignRequests]);

  // Auto-selection logic
  const findCorrespondingRequest = useCallback((selectedRequest: HarRequest, targetRequests: HarRequest[]): HarRequest | null => {
    if (!autoSelect) return null;

    // First try to find exact match by method and path (without query params for GET)
    const selectedPath = selectedRequest.method.toUpperCase() === 'GET'
      ? selectedRequest.path.split('?')[0]
      : selectedRequest.path;

    const exactMatch = targetRequests.find(req => {
      const reqPath = req.method.toUpperCase() === 'GET'
        ? req.path.split('?')[0]
        : req.path;
      return req.method === selectedRequest.method && reqPath === selectedPath;
    });

    if (exactMatch) return exactMatch;

    // If no exact match, try to find by path only
    const pathMatch = targetRequests.find(req => {
      const reqPath = req.method.toUpperCase() === 'GET'
        ? req.path.split('?')[0]
        : req.path;
      return reqPath === selectedPath;
    });

    return pathMatch || null;
  }, [autoSelect]);

  // Enhanced selection handlers with auto-selection
  const handleSelectRequest1 = useCallback((request: HarRequest) => {
    setSelectedRequest1(request);

    if (autoSelect && harFile2) {
      const corresponding = findCorrespondingRequest(request, harFile2.requests);
      if (corresponding) {
        setSelectedRequest2(corresponding);
      }
    }
  }, [autoSelect, harFile2, findCorrespondingRequest]);

  const handleSelectRequest2 = useCallback((request: HarRequest) => {
    setSelectedRequest2(request);

    if (autoSelect && harFile1) {
      const corresponding = findCorrespondingRequest(request, harFile1.requests);
      if (corresponding) {
        setSelectedRequest1(corresponding);
      }
    }
  }, [autoSelect, harFile1, findCorrespondingRequest]);

  const openHarFile = async (fileNumber: 1 | 2) => {
    setLoading(true);
    try {
      const result = await invoke<HarFile | null>("open_har_file");
      if (result) {
        if (fileNumber === 1) {
          setHarFile1(result);
        } else {
          setHarFile2(result);
        }
      }
    } catch (error) {
      console.error("Failed to open HAR file:", error);
      alert(`Failed to open HAR file: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const compareFiles = async () => {
    if (!harFile1 || !harFile2) return;

    try {
      const commandName = alignRequests ? "align_har_requests_vscode" : "align_har_requests";
      const aligned = await invoke<AlignedPair[]>(commandName, {
        requests1: harFile1.requests,
        requests2: harFile2.requests,
      });
      setAlignedPairs(aligned);
    } catch (error) {
      console.error("Failed to compare files:", error);
    }
  };

  const openDetailedComparison = async () => {
    if (!selectedRequest1 || !selectedRequest2) {
      alert("Please select requests from both files first");
      return;
    }

    try {
      const detailed = await invoke<DetailedComparison>("get_detailed_comparison", {
        req1: selectedRequest1,
        req2: selectedRequest2,
        keysOnly,
      });

      setDetailedComparisonData(detailed);
      setShowDetailedComparison(true);
    } catch (error) {
      console.error("Failed to get detailed comparison:", error);
      alert(`Failed to get detailed comparison: ${error}`);
    }
  };

  const getComparisonColor = (comparison?: ComparisonResult) => {
    if (!comparison) return "var(--color-different)";
    switch (comparison.status) {
      case "match": return "var(--color-match)";
      case "partial": return "var(--color-partial)";
      default: return "var(--color-different)";
    }
  };



  return (
    <div className="app">
      <header className="app-header">
        <h1>HAR File Comparer</h1>
        <div className="controls">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={keysOnly}
              onChange={(e) => setKeysOnly(e.target.checked)}
            />
            Compare keys only
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={alignRequests}
              onChange={(e) => setAlignRequests(e.target.checked)}
            />
            Align requests one-to-one
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              disabled={!alignRequests}
            />
            Synchronized scrolling
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoSelect}
              onChange={(e) => setAutoSelect(e.target.checked)}
            />
            Auto-select corresponding request
          </label>
          {harFile1 && harFile2 && (
            <button onClick={compareFiles} className="compare-btn">
              Compare Files
            </button>
          )}
          {selectedRequest1 && selectedRequest2 && (
            <button onClick={openDetailedComparison} className="compare-btn">
              Detailed Comparison
            </button>
          )}
        </div>
      </header>

      <main className="main-content">
        <div className="file-panels">
          <div className="file-panel">
            <div className="panel-header">
              <h2>Original HAR File</h2>
              <button
                onClick={() => openHarFile(1)}
                className="open-file-btn"
                disabled={loading}
              >
                {loading ? "Loading..." : "Open HAR File"}
              </button>
            </div>
            {harFile1 && (
              <div className="file-info">
                <p>{harFile1.file_path}</p>
                <p>{harFile1.requests.length} requests</p>
              </div>
            )}
            <div
              className="requests-list"
              ref={leftPanelRef}
              onScroll={handleLeftScroll}
            >
              {alignedPairs.length > 0 ? (
                alignedPairs.map((pair, index) => {
                  const request = pair.index1 !== undefined ? harFile1?.requests[pair.index1] : null;
                  return (
                    <div
                      key={index}
                      className={`request-item ${selectedRequest1 === request ? 'selected' : ''}`}
                      style={{ backgroundColor: getComparisonColor(pair.comparison) }}
                      onClick={() => request && handleSelectRequest1(request)}
                      onDoubleClick={() => request && selectedRequest2 && openDetailedComparison()}
                    >
                      {request ? (
                        <>
                          <span className="index">{request.index}</span>
                          <span className="method">{request.method}</span>
                          <span className="path">{request.url}</span>
                          <span className="status">{request.response_status}</span>
                        </>
                      ) : (
                        <span className="empty">-</span>
                      )}
                    </div>
                  );
                })
              ) : harFile1 ? (
                harFile1.requests.map((request, index) => (
                  <div
                    key={index}
                    className={`request-item ${selectedRequest1 === request ? 'selected' : ''}`}
                    onClick={() => handleSelectRequest1(request)}
                    onDoubleClick={() => selectedRequest2 && openDetailedComparison()}
                  >
                    <span className="index">{request.index}</span>
                    <span className="method">{request.method}</span>
                    <span className="path">{request.url}</span>
                    <span className="status">{request.response_status}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">No HAR file loaded</div>
              )}
            </div>
          </div>

          <div className="file-panel">
            <div className="panel-header">
              <h2>Comparison HAR File</h2>
              <button
                onClick={() => openHarFile(2)}
                className="open-file-btn"
                disabled={loading}
              >
                {loading ? "Loading..." : "Open HAR File"}
              </button>
            </div>
            {harFile2 && (
              <div className="file-info">
                <p>{harFile2.file_path}</p>
                <p>{harFile2.requests.length} requests</p>
              </div>
            )}
            <div
              className="requests-list"
              ref={rightPanelRef}
              onScroll={handleRightScroll}
            >
              {alignedPairs.length > 0 ? (
                alignedPairs.map((pair, index) => {
                  const request = pair.index2 !== undefined ? harFile2?.requests[pair.index2] : null;
                  return (
                    <div
                      key={index}
                      className={`request-item ${selectedRequest2 === request ? 'selected' : ''}`}
                      style={{ backgroundColor: getComparisonColor(pair.comparison) }}
                      onClick={() => request && handleSelectRequest2(request)}
                      onDoubleClick={() => request && selectedRequest1 && openDetailedComparison()}
                    >
                      {request ? (
                        <>
                          <span className="index">{request.index}</span>
                          <span className="method">{request.method}</span>
                          <span className="path">{request.url}</span>
                          <span className="status">{request.response_status}</span>
                        </>
                      ) : (
                        <span className="empty">-</span>
                      )}
                    </div>
                  );
                })
              ) : harFile2 ? (
                harFile2.requests.map((request, index) => (
                  <div
                    key={index}
                    className={`request-item ${selectedRequest2 === request ? 'selected' : ''}`}
                    onClick={() => handleSelectRequest2(request)}
                    onDoubleClick={() => selectedRequest1 && openDetailedComparison()}
                  >
                    <span className="index">{request.index}</span>
                    <span className="method">{request.method}</span>
                    <span className="path">{request.url}</span>
                    <span className="status">{request.response_status}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">No HAR file loaded</div>
              )}
            </div>
          </div>
        </div>


      </main>

      <footer className="legend">
        <span className="legend-item">
          <span className="legend-color" style={{ backgroundColor: "var(--color-match)" }}></span>
          Match
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ backgroundColor: "var(--color-partial)" }}></span>
          Partial
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ backgroundColor: "var(--color-different)" }}></span>
          Different
        </span>
      </footer>

      {/* Detailed Comparison Modal */}
      {showDetailedComparison && detailedComparisonData && selectedRequest1 && selectedRequest2 && (
        <DetailedComparisonModal
          detailed={detailedComparisonData}
          req1={selectedRequest1}
          req2={selectedRequest2}
          onClose={() => setShowDetailedComparison(false)}
        />
      )}
    </div>
  );
}

// Detailed Comparison Modal Component
interface DetailedComparisonModalProps {
  detailed: DetailedComparison;
  req1: HarRequest;
  req2: HarRequest;
  onClose: () => void;
}

function DetailedComparisonModal({ detailed, req1, req2, onClose }: DetailedComparisonModalProps) {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Detailed Comparison</h2>
          <p>
            Comparing: [{req1.index}] {req1.method} {req1.path} vs [{req2.index}] {req2.method} {req2.path}
          </p>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`modal-tab ${activeTab === 'raw_request' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw_request')}
          >
            Raw Request
          </button>
          <button
            className={`modal-tab ${activeTab === 'headers' ? 'active' : ''}`}
            onClick={() => setActiveTab('headers')}
          >
            Headers
          </button>
          {detailed.payloads && (
            <button
              className={`modal-tab ${activeTab === 'payloads' ? 'active' : ''}`}
              onClick={() => setActiveTab('payloads')}
            >
              Payloads
            </button>
          )}
          <button
            className={`modal-tab ${activeTab === 'params' ? 'active' : ''}`}
            onClick={() => setActiveTab('params')}
          >
            Parameters
          </button>
          {detailed.body && (
            <button
              className={`modal-tab ${activeTab === 'body' ? 'active' : ''}`}
              onClick={() => setActiveTab('body')}
            >
              Request Body
            </button>
          )}
          <button
            className={`modal-tab ${activeTab === 'response' ? 'active' : ''}`}
            onClick={() => setActiveTab('response')}
          >
            Response
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'general' && (
            <DiffView section={detailed.general} title1="File 1" title2="File 2" />
          )}

          {activeTab === 'raw_request' && (
            <DiffView section={detailed.raw_request} title1="File 1 Raw Request" title2="File 2 Raw Request" />
          )}

          {activeTab === 'headers' && (
            <DiffView section={detailed.headers} title1="File 1 Headers" title2="File 2 Headers" />
          )}

          {activeTab === 'payloads' && detailed.payloads && (
            <DiffView section={detailed.payloads} title1="File 1 Payload" title2="File 2 Payload" />
          )}

          {activeTab === 'params' && (
            <DiffView section={detailed.params} title1="File 1 Parameters" title2="File 2 Parameters" />
          )}

          {activeTab === 'body' && detailed.body && (
            <DiffView section={detailed.body} title1="File 1 Request Body" title2="File 2 Request Body" />
          )}

          {activeTab === 'response' && (
            <DiffView section={detailed.response} title1="File 1 Response" title2="File 2 Response" />
          )}
        </div>
      </div>
    </div>
  );
}

// Professional Diff View Component using react-diff-viewer-continued
interface DiffViewProps {
  section: ComparisonSection;
  title1: string;
  title2: string;
}

function DiffView({ section, title1, title2 }: DiffViewProps) {
  return (
    <div className="professional-diff-container">
      <ReactDiffViewer
        oldValue={section.content1}
        newValue={section.content2}
        splitView={true}
        leftTitle={title1}
        rightTitle={title2}
        useDarkTheme={true}
        showDiffOnly={false}
        hideLineNumbers={false}
        styles={{
          variables: {
            dark: {
              diffViewerBackground: '#0d1117',
              diffViewerColor: '#f0f6fc',
              addedBackground: 'rgba(46, 160, 67, 0.15)',
              addedColor: '#f0f6fc',
              removedBackground: 'rgba(248, 81, 73, 0.15)',
              removedColor: '#f0f6fc',
              wordAddedBackground: 'rgba(46, 160, 67, 0.4)',
              wordRemovedBackground: 'rgba(248, 81, 73, 0.4)',
              addedGutterBackground: 'rgba(46, 160, 67, 0.3)',
              removedGutterBackground: 'rgba(248, 81, 73, 0.3)',
              gutterBackground: '#161b22',
              gutterBackgroundDark: '#21262d',
              highlightBackground: '#fffbdd',
              highlightGutterBackground: '#fff5b1',
              codeFoldGutterBackground: '#21262d',
              codeFoldBackground: '#161b22',
              emptyLineBackground: '#0d1117',
              gutterColor: '#8b949e',
              addedGutterColor: '#f0f6fc',
              removedGutterColor: '#f0f6fc',
              codeFoldContentColor: '#8b949e',
              diffViewerTitleBackground: '#21262d',
              diffViewerTitleColor: '#f0f6fc',
              diffViewerTitleBorderColor: '#30363d',
            }
          },
          diffContainer: {
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '0.875rem',
          },
          titleBlock: {
            padding: '0.75rem 1rem',
            fontWeight: 'bold',
          }
        }}
      />
    </div>
  );
}

export default App;
