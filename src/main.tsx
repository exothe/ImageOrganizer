import React from 'react';
import ReactDOM from 'react-dom/client';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { App } from './App';
import { SettingsContextProvider } from './components/settings/SettingsContext';
import { OrganizerContextProvider } from './routes/main-screen/organizerContext';
import { FileListFocusContextProvider } from './components/file-list/fileListFocusContext';
import { ImageRoute } from './routes/image/ImageRoute';
import { ImageList } from './routes/image/ImageList';
import { ImageView } from './routes/image-view/ImageView';
import { ImageCompare } from './routes/image-compare/ImageCompare';

const router = createHashRouter([
    {
        path: '/',
        element: <App />,
        children: [
            {
                index: true,
                element: <Navigate to="/image/list" replace />,
            },
            {
                path: 'image',
                element: <ImageRoute />,
                children: [
                    {
                        path: 'list',
                        element: <ImageList />,
                    },
                    {
                        path: 'view',
                        element: <ImageView />,
                    },
                    {
                        path: 'compare',
                        element: <ImageCompare />,
                    },
                ],
            },
        ],
    },
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <Theme>
            <TooltipProvider>
                <SettingsContextProvider>
                    <OrganizerContextProvider>
                        <FileListFocusContextProvider>
                            <RouterProvider router={router} />
                        </FileListFocusContextProvider>
                    </OrganizerContextProvider>
                </SettingsContextProvider>
            </TooltipProvider>
        </Theme>
    </React.StrictMode>,
);
