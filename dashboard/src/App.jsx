import { useState, useEffect } from "react";

function App() {
  const [image, setImage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const portAddress = "xxx"

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch image
      const imgRes = await fetch(`${portAddress}/current-image`);
      if (imgRes.ok) {
        const imgBlob = await imgRes.blob();
        setImage(URL.createObjectURL(imgBlob));
      } else {
        setImage(null); // No image yet
      }

      // Fetch logs
      const logRes = await fetch(`${portAddress}/logs`);
      if (logRes.ok) {
        const logsData = await logRes.json();
        setLogs(logsData.reverse()); // Latest first
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const captureImage = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${portAddress}/capture`,{
        method: "POST",
      });

      if (res.ok) {
        await fetchData();
      } else {
        alert("Failed to capture image.");
      }
    } catch (err) {
      console.error("Error capturing image:", err);
    } finally {
      setLoading(false);
    }
  };
  const processImage = async () => {
    try {
      setProcessing(true);
      const res = await fetch(`${portAddress}/process`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchData();
      } else {
        alert("Processing failed.");
      }
    } catch (err) {
      console.error("Processing error:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleRetake = async () => {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch(`${portAddress}/retake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setStatus("Retake requested!");
      } else {
        setStatus("Failed to request retake.");
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus("Error sending retake request.");
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-4">📷 ESP32 Image Dashboard</h1>

      <div className="flex gap-4 mb-6">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          onClick={captureImage}
          disabled={loading}
        >
          📸 Capture Image
        </button>
        <button
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
          onClick={processImage}
          disabled={processing}
        >
          ⚙️ Process Image
        </button>
        <button
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          onClick={fetchData}
          disabled={loading || processing}
        ></button>
        <button
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          onClick={fetchData}
          disabled={loading}
        >
          🔄 Refresh
        </button>
        <button
          onClick={handleRetake}
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
          disabled={loading}
        >
          {loading ? "Requesting..." : "Retake Image"}
        </button>
      </div>

      {image ? (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Latest Image:</h2>
          <img
            src={image}
            alt="Latest capture"
            className="border shadow rounded max-w-full h-auto"
          />
        </div>
      ) : (
        <p className="text-gray-500 mb-6">No image processed yet.</p>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-2">📜 Processed Logs:</h2>
        {logs.length > 0 ? (
          <table className="w-full text-left border border-gray-300">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2">Timestamp</th>
                <th className="p-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-2">{log.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">No logs yet.</p>
        )}
      </div>
    </div>
  );
}

export default App;
