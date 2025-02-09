import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, Link, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Papa from "papaparse";
import Plot from "react-plotly.js";
import * as d3 from "d3-regression";
import ReactCompareImage from "react-compare-image";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "", // add your key here*
  dangerouslyAllowBrowser: true,
});

const analyzePopulationGrowth = async (townName, nearbyTown, populations, futurePop) => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an AI that analyzes historical and projected population growth trends to describe the future of towns.",
          },
          {
            role: "user",
            content: `Analyze the population growth trends for ${townName}, which is near ${nearbyTown}. Based on historical population data: ${populations.join(", ")} and projected future populations: ${futurePop.join(", ")}, provide a one-paragraph summary about the town's trajectory. Discuss whether the town is likely to grow, remain stagnant, or decline further. Truncate any numbers used in your reasoning by 2 decimal places`,
          },
        ],
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error("Error generating AI analysis:", error);
      return "Unable to analyze population trends at the moment.";
    }
  };

const customIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
});

const TexasMap = () => {
  const [ghostTowns, setGhostTowns] = useState([]);
  useEffect(() => {
    fetch("/ghost_towns.csv")
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            const parsedData = result.data.map((row) => {
              if (row.COORDINATES) {
                const coordsMatch = row.COORDINATES.match(/\(([^,]+),\s*([^\)]+)\)/);
                if (coordsMatch) {
                  return {
                    name: row.GHOSTTOWNNAME.trim(),
                    county: row.COUNTY.trim(),
                    description: row.DESCRIPTION.trim(),
                    nearbyTown: row.NEARBYTOWN.trim(),
                    population: row.POPULATION ? row.POPULATION.trim() : "Unknown",
                    lat: parseFloat(coordsMatch[1]),
                    lng: parseFloat(coordsMatch[2]),
                  };
                }
              }
              return null;
            }).filter(Boolean);
            setGhostTowns(parsedData);
          },
        });
      })
      .catch(error => console.error("Error loading CSV file:", error));
  }, []);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <MapContainer
        center={[31.9686, -99.9018]}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {ghostTowns.map((town, index) => (
          <Marker key={index} position={[town.lat, town.lng]} icon={customIcon}>
            <Popup>
              <strong>{town.name}</strong> ({town.county} County)
              <br />Population: {town.population}
              <br />{town.description}
              <br /><em>Near: {town.nearbyTown}</em>
              <br /><Link to={`/ghost-town/${town.name.replace(/\s+/g, '-').toLowerCase()}`}>See more</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

const HomePage = () => {
    return (
      <div style={{padding: "0px" }}>
        <h3>
          <Link to="/why-ghost-towns">Why should we care about ghost towns?</Link>
        </h3>
        <TexasMap />
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <img src="/logo.jpeg" alt="Logo" style={{ width: "150px", height: "150px" }} />
        </div>
      </div>
    );
  };
  
  const WhyGhostTownsPage = () => {
    return (
      <div style={{ padding: "20px", maxWidth: "800px", margin: "auto" }}>
        <h2>Why Should We Care About Ghost Towns?</h2>
        <p>
          Ghost towns are remnants of history, offering insights into economic booms and declines,
          migration patterns, and how communities thrive or collapse. Understanding how these towns
          rose and fell can help us anticipate urban challenges in the future, such as economic shifts,
          resource depletion, and changes in population trends.
        </p>
        <p>
          By studying ghost towns, we can learn valuable lessons about sustainability, urban planning,
          and how societies adapt (or fail to adapt) to changing circumstances.
        </p>
        <Link to="/">Back to Home</Link>
        <div style={{ marginTop: "20px", textAlign: "center" }}>
            <img src="/logo.jpeg" alt="Logo" style={{ width: "150px", height: "150px" }} />
        </div>
      </div>
    );
  };

const GhostTownPage = () => {
    const { townName } = useParams();
    const [data, setData] = useState(null);
    const [populationAnalysis, setPopulationAnalysis] = useState("Analyzing town population trends...");

  useEffect(() => {
    fetch("/ghost_towns.csv")
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: async (result) => {
            const townData = result.data.find(
              (d) => d.GHOSTTOWNNAME.toLowerCase().replace(/\s+/g, "-") === townName
            );
            if (townData) {
              fetch("/nearbycitiespopulationgrowth.csv")
                .then(response => response.text())
                .then(cityText => {
                  Papa.parse(cityText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: async (cityResult) => {
                      const cityData = cityResult.data.find(
                        (d) => d.CITY_NM.trim().toLowerCase() === townData.NEARBYTOWN.trim().toLowerCase()
                      );
                      if (cityData) {
                        const years = [1990, 2000, 2010];
                        const populations = [
                          parseInt(cityData.POP1990),
                          parseInt(cityData.POP2000),
                          parseInt(cityData.POP2010),
                        ];
                        const futureYears = [2020, 2030, 2040];
                        const regression = d3.regressionLinear().x((d, i) => years[i]).y(d => d);
                        const line = regression(populations);
                        const futurePop = futureYears.map((year) => line.predict(year));

                        const beforeImage = `/images/${townData.GHOSTTOWNNAME.replace(
                          /\s+/g,
                          "-"
                        ).toLowerCase()}_before.png`;
                        const afterImage = `/images/${townData.GHOSTTOWNNAME.replace(
                          /\s+/g,
                          "-"
                        ).toLowerCase()}_after.png`;

                        setData({
                          years: [...years, ...futureYears],
                          populations: [...populations, ...futurePop],
                          townName: townData.GHOSTTOWNNAME,
                          nearbyTown: townData.NEARBYTOWN,
                          abandonedReason: townData.ABANDONEDREASON,
                          beforeImage,
                          afterImage,
                        });

                        const analysis = await analyzePopulationGrowth(townData.GHOSTTOWNNAME, townData.NEARBYTOWN, populations, futurePop);
                        setPopulationAnalysis(analysis);
                      }
                    },
                  });
                });
            }
          },
        });
      });
  }, [townName]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>{data?.townName}</h2>
      <p>Projected Population Growth (based on {data?.nearbyTown})</p>
      <p><strong>Reason for Abandonment:</strong> {data?.abandonedReason || "Unknown"}</p>
      {data && (
        <Plot
          data={[{
            x: data.years,
            y: data.populations,
            type: 'scatter',
            mode: 'lines+markers',
            marker: { color: 'blue' },
          }]}
          layout={{
            title: `Projected Growth for ${data.townName}`,
            xaxis: { title: "Year" },
            yaxis: { title: "Population" },
          }}
        />
      )}
      <div style={{ marginTop: "20px", padding: "20px", backgroundColor: "#f9f9f9", borderRadius: "10px" }}>
        <h3 style={{ textAlign: "center" }}>AI Analysis of Population Trends</h3>
        <p style={{ textAlign: "center", fontStyle: "italic" }}>{populationAnalysis}</p>
      </div>
      <h3 style={{ textAlign: "center" }}>Historical vs. Projected View</h3>
      <div style={{ display: "flex", justifyContent: "center", maxWidth: "800px", margin: "auto" }}>
        <ReactCompareImage
          leftImage={`/images/${data?.townName.replace(/\s+/g, '-').toLowerCase()}_before.png`}
          rightImage={`/images/${data?.townName.replace(/\s+/g, '-').toLowerCase()}_after.png`}
        />
      </div>
      <Link to="/">Back to Map</Link>
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <img src="/logo.jpeg" alt="Logo" style={{ width: "150px", height: "150px" }} />
      </div>
    </div>
  );
};

const App = () => {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/why-ghost-towns" element={<WhyGhostTownsPage />} />
          <Route path="/ghost-town/:townName" element={<GhostTownPage />} />
        </Routes>
      </Router>
    );
  };
  
  export default App;