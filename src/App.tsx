import './App.css';
import { SettingsContextProvider } from './components/settings/SettingsContext';
import { ImageOrganizer } from './routes/main-screen/ImageOrganizer';
import { OrganizerContextProvider } from './routes/main-screen/organizerContext';

function App() {
    return (
        <SettingsContextProvider>
            <OrganizerContextProvider>
                <ImageOrganizer />
            </OrganizerContextProvider>
        </SettingsContextProvider>
    );
}

export default App;
