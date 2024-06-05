import "./App.css";
import { ImageOrganizer } from "./routes/main-screen/ImageOrganizer";
import { OrganizerContextProvider } from "./routes/main-screen/organizerContext";

function App() {
  return (
    <OrganizerContextProvider>
      <ImageOrganizer />
    </OrganizerContextProvider>
  );
}

export default App;
