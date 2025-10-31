import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  whitelisted_keys: string[];
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
  const [whitelistLoaded, setWhitelistLoaded] = useState(false);

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

  const loadWhitelistConfig = async () => {
    try {
      const result = await invoke<boolean>("load_whitelist_config");
      if (result) {
        setWhitelistLoaded(true);
        // Trigger re-comparison if both files are loaded
        if (harFile1 && harFile2 && alignedPairs.length > 0) {
          await compareFiles();
        }
        alert("Whitelist config loaded successfully");
      }
    } catch (error) {
      console.error("Failed to load whitelist config:", error);
      alert(`Failed to load whitelist config: ${error}`);
    }
  };

  const clearWhitelistConfig = async () => {
    try {
      await invoke("clear_whitelist_config");
      setWhitelistLoaded(false);
      // Trigger re-comparison if both files are loaded
      if (harFile1 && harFile2 && alignedPairs.length > 0) {
        await compareFiles();
      }
      alert("Whitelist config cleared");
    } catch (error) {
      console.error("Failed to clear whitelist config:", error);
      alert(`Failed to clear whitelist config: ${error}`);
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
      case "whitelisted": return "var(--color-whitelisted)";
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
          <button onClick={loadWhitelistConfig} className="compare-btn">
            {whitelistLoaded ? "Reload Whitelist" : "Load Whitelist"}
          </button>
          {whitelistLoaded && (
            <button onClick={clearWhitelistConfig} className="compare-btn">
              Clear Whitelist
            </button>
          )}
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
          <span className="legend-color" style={{ backgroundColor: "var(--color-whitelisted)" }}></span>
          Whitelisted
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

// Custom Diff View Component with Whitelist Support
interface DiffViewProps {
  section: ComparisonSection;
  title1: string;
  title2: string;
}

interface DiffLineData {
  lineNum: number;
  content: string;
  type: 'same' | 'added' | 'removed' | 'whitelisted';
}

function DiffView({ section, title1, title2 }: DiffViewProps) {
  const [copiedButton, setCopiedButton] = useState<string | null>(null);

  // Refs for synchronized scrolling
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  const copyToClipboard = async (text: string, side: string, buttonId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${side} content copied to clipboard`);

      // Show visual feedback
      setCopiedButton(buttonId);
      setTimeout(() => {
        setCopiedButton(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Synchronized scrolling handlers
  const handleLeftScroll = useCallback(() => {
    if (isScrollingRef.current) return;

    const leftPane = leftPaneRef.current;
    const rightPane = rightPaneRef.current;

    if (leftPane && rightPane) {
      isScrollingRef.current = true;
      rightPane.scrollTop = leftPane.scrollTop;
      rightPane.scrollLeft = leftPane.scrollLeft;
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 10);
    }
  }, []);

  const handleRightScroll = useCallback(() => {
    if (isScrollingRef.current) return;

    const leftPane = leftPaneRef.current;
    const rightPane = rightPaneRef.current;

    if (leftPane && rightPane) {
      isScrollingRef.current = true;
      leftPane.scrollTop = rightPane.scrollTop;
      leftPane.scrollLeft = rightPane.scrollLeft;
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 10);
    }
  }, []);

  // Simple line-by-line diff algorithm
  const computeDiff = (): { left: DiffLineData[]; right: DiffLineData[] } => {
    const lines1 = section.content1.split('\n');
    const lines2 = section.content2.split('\n');
    const left: DiffLineData[] = [];
    const right: DiffLineData[] = [];

    const maxLen = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLen; i++) {
      const line1 = lines1[i] !== undefined ? lines1[i] : '';
      const line2 = lines2[i] !== undefined ? lines2[i] : '';

      if (line1 === line2) {
        // Lines are identical
        left.push({ lineNum: i + 1, content: line1, type: 'same' });
        right.push({ lineNum: i + 1, content: line2, type: 'same' });
      } else {
        // Lines are different - check if whitelisted
        const isWhitelisted = isLineWhitelisted(line1, line2, section.whitelisted_keys);

        if (lines1[i] === undefined) {
          // Line only in right side
          left.push({ lineNum: i + 1, content: '', type: 'same' });
          right.push({ lineNum: i + 1, content: line2, type: isWhitelisted ? 'whitelisted' : 'added' });
        } else if (lines2[i] === undefined) {
          // Line only in left side
          left.push({ lineNum: i + 1, content: line1, type: isWhitelisted ? 'whitelisted' : 'removed' });
          right.push({ lineNum: i + 1, content: '', type: 'same' });
        } else {
          // Both lines exist but are different
          left.push({ lineNum: i + 1, content: line1, type: isWhitelisted ? 'whitelisted' : 'removed' });
          right.push({ lineNum: i + 1, content: line2, type: isWhitelisted ? 'whitelisted' : 'added' });
        }
      }
    }

    return { left, right };
  };

  const isLineWhitelisted = (line1: string, line2: string, whitelistedKeys: string[]): boolean => {
    if (whitelistedKeys.length === 0) return false;

    // Check if the line contains any whitelisted key
    const lineLower1 = line1.toLowerCase();
    const lineLower2 = line2.toLowerCase();

    for (const key of whitelistedKeys) {
      // Check if the line starts with the key (for "key: value" format)
      if (lineLower1.startsWith(key + ':') || lineLower2.startsWith(key + ':')) {
        return true;
      }
      // Check if the line contains the key as a JSON property (for "key": value format)
      if (lineLower1.includes(`"${key}"`) || lineLower2.includes(`"${key}"`)) {
        return true;
      }
    }

    return false;
  };

  const { left, right } = computeDiff();

  const getLineClass = (type: string): string => {
    switch (type) {
      case 'added': return 'diff-line-added';
      case 'removed': return 'diff-line-removed';
      case 'whitelisted': return 'diff-line-whitelisted';
      default: return 'diff-line-same';
    }
  };

  return (
    <div className="custom-diff-container">
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

      {/* Split view diff */}
      <div className="diff-split-view">
        <div
          className="diff-pane"
          ref={leftPaneRef}
          onScroll={handleLeftScroll}
        >
          {left.map((line, index) => (
            <div key={index} className={`diff-line ${getLineClass(line.type)}`}>
              <span className="diff-line-number">{line.content ? line.lineNum : ''}</span>
              <pre className="diff-line-content">{line.content || ' '}</pre>
            </div>
          ))}
        </div>
        <div
          className="diff-pane"
          ref={rightPaneRef}
          onScroll={handleRightScroll}
        >
          {right.map((line, index) => (
            <div key={index} className={`diff-line ${getLineClass(line.type)}`}>
              <span className="diff-line-number">{line.content ? line.lineNum : ''}</span>
              <pre className="diff-line-content">{line.content || ' '}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
