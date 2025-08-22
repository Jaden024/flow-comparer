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
  response: ComparisonSection;
  response_body?: ComparisonSection;
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
  const [indexInput1, setIndexInput1] = useState<string>('');
  const [indexInput2, setIndexInput2] = useState<string>('');
  const [showDetailedComparison, setShowDetailedComparison] = useState(false);
  const [detailedComparisonData, setDetailedComparisonData] = useState<DetailedComparison | null>(null);

  // Refs for synchronized scrolling
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Synchronized scrolling handlers
  const handleLeftScroll = useCallback(() => {
    if (!syncScroll || isScrollingRef.current) return;

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;

    if (leftPanel && rightPanel) {
      isScrollingRef.current = true;
      rightPanel.scrollTop = leftPanel.scrollTop;
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 10);
    }
  }, [syncScroll]);

  const handleRightScroll = useCallback(() => {
    if (!syncScroll || isScrollingRef.current) return;

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;

    if (leftPanel && rightPanel) {
      isScrollingRef.current = true;
      leftPanel.scrollTop = rightPanel.scrollTop;
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 10);
    }
  }, [syncScroll]);

  // Auto-selection logic - select by HTML list position (visual index in requests-list)
  const findCorrespondingRequest2ByListPosition = useCallback((listPosition: number): { request: HarRequest | null, shouldSelect: boolean } => {
    if (!autoSelect) return { request: null, shouldSelect: false };

    // When using aligned pairs, find the request at the same visual list position
    if (alignedPairs.length > 0 && listPosition >= 0 && listPosition < alignedPairs.length) {
      const pair = alignedPairs[listPosition];
      // Return the request from the right side, or indicate we should select empty placeholder
      if (pair.index2 !== undefined && harFile2) {
        return { request: harFile2.requests[pair.index2], shouldSelect: true };
      } else {
        // This is an empty placeholder - we should select it (null request)
        return { request: null, shouldSelect: true };
      }
    }

    // When not using aligned pairs, use direct array index
    if (harFile2 && listPosition >= 0 && listPosition < harFile2.requests.length) {
      return { request: harFile2.requests[listPosition], shouldSelect: true };
    }

    return { request: null, shouldSelect: false };
  }, [autoSelect, alignedPairs, harFile2]);

  const findCorrespondingRequest1ByListPosition = useCallback((listPosition: number): { request: HarRequest | null, shouldSelect: boolean } => {
    if (!autoSelect) return { request: null, shouldSelect: false };

    // When using aligned pairs, find the request at the same visual list position
    if (alignedPairs.length > 0 && listPosition >= 0 && listPosition < alignedPairs.length) {
      const pair = alignedPairs[listPosition];
      // Return the request from the left side, or indicate we should select empty placeholder
      if (pair.index1 !== undefined && harFile1) {
        return { request: harFile1.requests[pair.index1], shouldSelect: true };
      } else {
        // This is an empty placeholder - we should select it (null request)
        return { request: null, shouldSelect: true };
      }
    }

    // When not using aligned pairs, use direct array index
    if (harFile1 && listPosition >= 0 && listPosition < harFile1.requests.length) {
      return { request: harFile1.requests[listPosition], shouldSelect: true };
    }

    return { request: null, shouldSelect: false };
  }, [autoSelect, alignedPairs, harFile1]);

  // Enhanced selection handlers with auto-selection by HTML list position
  const handleSelectRequest1 = useCallback((request: HarRequest | null, htmlListIndex: number) => {
    setSelectedRequest1(request);
    if (request) {
      setIndexInput1(request.index.toString()); // Update index input to match selection
    }

    if (autoSelect) {
      const corresponding = findCorrespondingRequest2ByListPosition(htmlListIndex);
      if (corresponding.shouldSelect) {
        setSelectedRequest2(corresponding.request);
        if (corresponding.request) {
          setIndexInput2(corresponding.request.index.toString());
        } else {
          setIndexInput2(''); // Empty placeholder selected
        }
      } else {
        // No corresponding position - clear selection
        setSelectedRequest2(null);
        setIndexInput2('');
      }
    }
  }, [autoSelect, findCorrespondingRequest2ByListPosition]);

  const handleSelectRequest2 = useCallback((request: HarRequest | null, htmlListIndex: number) => {
    setSelectedRequest2(request);
    if (request) {
      setIndexInput2(request.index.toString()); // Update index input to match selection
    }

    if (autoSelect) {
      const corresponding = findCorrespondingRequest1ByListPosition(htmlListIndex);
      if (corresponding.shouldSelect) {
        setSelectedRequest1(corresponding.request);
        if (corresponding.request) {
          setIndexInput1(corresponding.request.index.toString());
        } else {
          setIndexInput1(''); // Empty placeholder selected
        }
      } else {
        // No corresponding position - clear selection
        setSelectedRequest1(null);
        setIndexInput1('');
      }
    }
  }, [autoSelect, findCorrespondingRequest1ByListPosition]);

  // Index input handlers with auto-scroll
  const handleIndexInput1 = useCallback((value: string) => {
    setIndexInput1(value);

    if (value.trim() === '') {
      return; // Do nothing if input is empty
    }

    const index = parseInt(value, 10);
    if (isNaN(index) || !harFile1) {
      return;
    }

    // Find request by index
    const request = harFile1.requests.find(req => req.index === index);
    if (request) {
      // Find the HTML list position based on current display mode
      let htmlListIndex = -1;

      if (alignedPairs.length > 0) {
        // When using aligned pairs, find the position in the aligned pairs array
        htmlListIndex = alignedPairs.findIndex(pair =>
          pair.index1 !== undefined && harFile1.requests[pair.index1]?.index === index
        );
      } else {
        // When not using aligned pairs, find position in the original requests array
        htmlListIndex = harFile1.requests.findIndex(req => req.index === index);
      }

      if (htmlListIndex >= 0) {
        handleSelectRequest1(request, htmlListIndex);

        // Scroll to the selected item
        setTimeout(() => {
          const leftPanel = leftPanelRef.current;
          if (leftPanel) {
            const requestItems = leftPanel.querySelectorAll('.request-item');
            const targetItem = requestItems[htmlListIndex];
            if (targetItem) {
              targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 100);
      }
    }
  }, [harFile1, handleSelectRequest1, alignedPairs]);

  const handleIndexInput2 = useCallback((value: string) => {
    setIndexInput2(value);

    if (value.trim() === '') {
      return; // Do nothing if input is empty
    }

    const index = parseInt(value, 10);
    if (isNaN(index) || !harFile2) {
      return;
    }

    // Find request by index
    const request = harFile2.requests.find(req => req.index === index);
    if (request) {
      // Find the HTML list position based on current display mode
      let htmlListIndex = -1;

      if (alignedPairs.length > 0) {
        // When using aligned pairs, find the position in the aligned pairs array
        htmlListIndex = alignedPairs.findIndex(pair =>
          pair.index2 !== undefined && harFile2.requests[pair.index2]?.index === index
        );
      } else {
        // When not using aligned pairs, find position in the original requests array
        htmlListIndex = harFile2.requests.findIndex(req => req.index === index);
      }

      if (htmlListIndex >= 0) {
        handleSelectRequest2(request, htmlListIndex);

        // Scroll to the selected item
        setTimeout(() => {
          const rightPanel = rightPanelRef.current;
          if (rightPanel) {
            const requestItems = rightPanel.querySelectorAll('.request-item');
            const targetItem = requestItems[htmlListIndex];
            if (targetItem) {
              targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 100);
      }
    }
  }, [harFile2, handleSelectRequest2, alignedPairs]);

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
              <div className="panel-controls">
                <div className="index-input-container">
                  <label htmlFor="index1">Go to index:</label>
                  <input
                    id="index1"
                    type="number"
                    value={indexInput1}
                    onChange={(e) => handleIndexInput1(e.target.value)}
                    placeholder="Enter index"
                    className="index-input"
                    min="0"
                    disabled={!harFile1}
                  />
                </div>
                <button
                  onClick={() => openHarFile(1)}
                  className="open-file-btn"
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Open HAR File"}
                </button>
              </div>
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
                      className={`request-item ${selectedRequest1 === (request || null) ? 'selected' : ''}`}
                      style={{ backgroundColor: getComparisonColor(pair.comparison) }}
                      onClick={() => handleSelectRequest1(request || null, index)}
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
                    onClick={() => handleSelectRequest1(request, index)}
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
              <div className="panel-controls">
                <div className="index-input-container">
                  <label htmlFor="index2">Go to index:</label>
                  <input
                    id="index2"
                    type="number"
                    value={indexInput2}
                    onChange={(e) => handleIndexInput2(e.target.value)}
                    placeholder="Enter index"
                    className="index-input"
                    min="0"
                    disabled={!harFile2}
                  />
                </div>
                <button
                  onClick={() => openHarFile(2)}
                  className="open-file-btn"
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Open HAR File"}
                </button>
              </div>
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
                      className={`request-item ${selectedRequest2 === (request || null) ? 'selected' : ''}`}
                      style={{ backgroundColor: getComparisonColor(pair.comparison) }}
                      onClick={() => handleSelectRequest2(request || null, index)}
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
                    onClick={() => handleSelectRequest2(request, index)}
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
          <button
            className={`modal-tab ${activeTab === 'response' ? 'active' : ''}`}
            onClick={() => setActiveTab('response')}
          >
            Response
          </button>
          {detailed.response_body && (
            <button
              className={`modal-tab ${activeTab === 'response_body' ? 'active' : ''}`}
              onClick={() => setActiveTab('response_body')}
            >
              Response Body
            </button>
          )}
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

          {activeTab === 'response' && (
            <DiffView section={detailed.response} title1="File 1 Response" title2="File 2 Response" />
          )}

          {activeTab === 'response_body' && detailed.response_body && (
            <DiffView section={detailed.response_body} title1="File 1 Response Body" title2="File 2 Response Body" />
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
  const [copiedButton, setCopiedButton] = useState<string | null>(null);

  const copyToClipboard = async (text: string, side: string, buttonId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${side} content copied to clipboard`);

      // Show visual feedback
      setCopiedButton(buttonId);
      setTimeout(() => {
        setCopiedButton(null);
      }, 1500); // Reset after 1.5 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="professional-diff-container">
      {/* Custom title bar with copy buttons */}
      <div className="diff-title-bar">
        <div className="diff-title-section">
          <span className="diff-title">{title1}</span>
          <button
            className={`copy-button ${copiedButton === 'left' ? 'copied' : ''}`}
            onClick={() => copyToClipboard(section.content1, title1, 'left')}
            title={`Copy ${title1} content`}
          >
            {copiedButton === 'left' ? '✓' : '📋'}
          </button>
        </div>
        <div className="diff-title-section">
          <span className="diff-title">{title2}</span>
          <button
            className={`copy-button ${copiedButton === 'right' ? 'copied' : ''}`}
            onClick={() => copyToClipboard(section.content2, title2, 'right')}
            title={`Copy ${title2} content`}
          >
            {copiedButton === 'right' ? '✓' : '📋'}
          </button>
        </div>
      </div>

      <ReactDiffViewer
        oldValue={section.content1}
        newValue={section.content2}
        splitView={true}
        leftTitle=""
        rightTitle=""
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
