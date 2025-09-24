/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, Suspense, lazy, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';

import Footer from './components/Footer.tsx';
import Home from './components/Home.tsx';
import SearchModal from './components/SearchModal.tsx';
import GalleryModal from './components/GalleryModal.tsx';
import InfoModal from './components/InfoModal.tsx';
import AppToolbar from './components/AppToolbar.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import UserStatus from './components/UserStatus.tsx';
import LanguageSwitcher from './components/LanguageSwitcher.tsx';
import HistoryPanel from './components/HistoryPanel.tsx';
import { ImageEditorModal } from './components/ImageEditorModal.tsx';
import {
    renderSmartlyWrappedTitle,
    useImageEditor,
    useAppControls,
    ImageLayoutModal,
    BeforeAfterModal,
    LayerComposerModal,
    useAuth,
    type AppConfig,
    type GenerationHistoryEntry,
} from './components/uiUtils.tsx';
import { LoadingSpinnerIcon } from './components/icons.tsx';

// Lazy load app components for code splitting
const ArchitectureIdeator = lazy(() => import('./components/ArchitectureIdeator.tsx'));
const AvatarCreator = lazy(() => import('./components/AvatarCreator.tsx'));
const BabyPhotoCreator = lazy(() => import('./components/BabyPhotoCreator.tsx'));
const DressTheModel = lazy(() => import('./components/DressTheModel.tsx'));
const PhotoRestoration = lazy(() => import('./components/PhotoRestoration.tsx'));
const ImageToReal = lazy(() => import('./components/ImageToReal.tsx'));
const SwapStyle = lazy(() => import('./components/SwapStyle.tsx'));
const MixStyle = lazy(() => import('./components/MixStyle.tsx'));
const FreeGeneration = lazy(() => import('./components/FreeGeneration.tsx'));
const ToyModelCreator = lazy(() => import('./components/ToyModelCreator.tsx'));
const ImageInterpolation = lazy(() => import('./components/ImageInterpolation.tsx'));


const AppLoadingFallback = () => (
    <div className="w-full h-full flex items-center justify-center">
        <LoadingSpinnerIcon className="animate-spin h-10 w-10 text-yellow-400" />
    </div>
);

function App() {
    const {
        currentView,
        settings,
        sessionGalleryImages,
        isSearchOpen,
        isGalleryOpen,
        isInfoOpen,
        isHistoryPanelOpen,
        isImageLayoutModalOpen,
        isBeforeAfterModalOpen,
        isLayerComposerMounted,
        isLayerComposerVisible,
        handleSelectApp,
        handleStateChange,
        addImagesToGallery,
        addGenerationToHistory,
        handleResetApp,
        handleGoBack,
        handleCloseSearch,
        handleCloseGallery,
        handleCloseInfo,
        handleCloseHistoryPanel,
        closeImageLayoutModal,
        closeBeforeAfterModal,
        closeLayerComposer,
        hideLayerComposer,
        t,
    } = useAppControls();
    
    const { imageToEdit, closeImageEditor } = useImageEditor();
    const { loginSettings, isLoggedIn, isLoading, currentUser } = useAuth();

    useEffect(() => {
        const isAnyModalOpen = isSearchOpen || 
                               isGalleryOpen || 
                               isInfoOpen ||
                               isHistoryPanelOpen ||
                               isImageLayoutModalOpen || 
                               isBeforeAfterModalOpen || 
                               isLayerComposerVisible || 
                               !!imageToEdit;

        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }

        // Cleanup function to ensure overflow is reset when the component unmounts
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isSearchOpen, isGalleryOpen, isInfoOpen, isHistoryPanelOpen, isImageLayoutModalOpen, isBeforeAfterModalOpen, isLayerComposerVisible, imageToEdit]);

    const getExportableState = useCallback((appState: any, viewId: string) => {
        const exportableState = JSON.parse(JSON.stringify(appState));
        const keysToRemove = [
            'generatedImage', 'generatedImages', 'historicalImages', 
            'finalPrompt', 'error',
        ];

        if (viewId !== 'image-interpolation') {
            keysToRemove.push('generatedPrompt', 'promptSuggestions');
        }

        const removeKeys = (obj: any) => {
            if (typeof obj !== 'object' || obj === null) return;
            for (const key of keysToRemove) {
                if (key in obj) delete obj[key];
            }
            if ('stage' in obj && (obj.stage === 'generating' || obj.stage === 'results' || obj.stage === 'prompting')) {
                 if (viewId === 'free-generation') obj.stage = 'configuring';
                 else if ( ('uploadedImage' in obj && obj.uploadedImage) || ('modelImage' in obj && obj.modelImage) || ('contentImage' in obj && obj.contentImage) || ('inputImage' in obj && obj.inputImage) ) {
                      obj.stage = 'configuring';
                 } else {
                     obj.stage = 'idle';
                 }
            }
            for (const key in obj) {
                if (typeof obj[key] === 'object') removeKeys(obj[key]);
            }
        };

        removeKeys(exportableState);
        return exportableState;
    }, []);

    const logGeneration = useCallback((appId: string, preGenState: any, thumbnailUrl: string) => {
        if (!settings) return;

        const appConfig = settings.apps.find((app: AppConfig) => app.id === appId);
        const appName = appConfig ? t(appConfig.titleKey) : appId;

        const cleanedState = getExportableState(preGenState, appId);

        const entry: Omit<GenerationHistoryEntry, 'id' | 'timestamp'> = {
            appId,
            appName: appName.replace(/\n/g, ' '),
            thumbnailUrl,
            settings: {
                viewId: appId,
                state: cleanedState,
            },
        };
        addGenerationToHistory(entry);
    }, [addGenerationToHistory, settings, t, getExportableState]);

    const renderContent = () => {
        if (!settings) return null; // Wait for settings to load

        const motionProps = {
            className: "w-full h-full flex-1 min-h-0",
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -20 },
            transition: { duration: 0.4 },
        };
        const commonProps = { 
            addImagesToGallery,
            onStateChange: handleStateChange,
            onReset: handleResetApp,
            onGoBack: handleGoBack,
            logGeneration,
        };

        switch (currentView.viewId) {
            case 'home':
                return (
                    <Home 
                        key="home"
                        onSelectApp={handleSelectApp} 
                        title={renderSmartlyWrappedTitle(t(settings.home.mainTitleKey), settings.home.useSmartTitleWrapping, settings.home.smartTitleWrapWords)}
                        subtitle={t(settings.home.subtitleKey)}
                        apps={settings.apps.map((app: AppConfig) => ({...app, title: t(app.titleKey), description: t(app.descriptionKey)}))}
                    />
                );
            case 'free-generation':
                 return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="free-generation" {...motionProps}>
                            <FreeGeneration 
                                {...settings.freeGeneration}
                                mainTitle={t(settings.freeGeneration.mainTitleKey)}
                                subtitle={t(settings.freeGeneration.subtitleKey)}
                                uploaderCaption1={t(settings.freeGeneration.uploaderCaption1Key)}
                                uploaderDescription1={t(settings.freeGeneration.uploaderDescription1Key)}
                                uploaderCaption2={t(settings.freeGeneration.uploaderCaption2Key)}
                                uploaderDescription2={t(settings.freeGeneration.uploaderDescription2Key)}
                                {...commonProps} 
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                );
            case 'architecture-ideator':
                 return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="architecture-ideator" {...motionProps}>
                            <ArchitectureIdeator 
                                {...settings.architectureIdeator} 
                                mainTitle={t(settings.architectureIdeator.mainTitleKey)}
                                subtitle={t(settings.architectureIdeator.subtitleKey)}
                                uploaderCaption={t(settings.architectureIdeator.uploaderCaptionKey)}
                                uploaderDescription={t(settings.architectureIdeator.uploaderDescriptionKey)}
                                {...commonProps} 
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                );
            case 'dress-the-model':
                return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="dress-the-model" {...motionProps}>
                            <DressTheModel 
                                {...settings.dressTheModel}
                                mainTitle={t(settings.dressTheModel.mainTitleKey)}
                                subtitle={t(settings.dressTheModel.subtitleKey)}
                                uploaderCaptionModel={t(settings.dressTheModel.uploaderCaptionModelKey)}
                                uploaderDescriptionModel={t(settings.dressTheModel.uploaderDescriptionModelKey)}
                                uploaderCaptionClothing={t(settings.dressTheModel.uploaderCaptionClothingKey)}
                                uploaderDescriptionClothing={t(settings.dressTheModel.uploaderDescriptionClothingKey)}
                                {...commonProps}
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                );
            case 'photo-restoration':
                return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="photo-restoration" {...motionProps}>
                            <PhotoRestoration 
                                {...settings.photoRestoration} 
                                mainTitle={t(settings.photoRestoration.mainTitleKey)}
                                subtitle={t(settings.photoRestoration.subtitleKey)}
                                uploaderCaption={t(settings.photoRestoration.uploaderCaptionKey)}
                                uploaderDescription={t(settings.photoRestoration.uploaderDescriptionKey)}
                                {...commonProps} 
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                );
            case 'image-to-real':
                return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="image-to-real" {...motionProps}>
                            <ImageToReal 
                                {...settings.imageToReal} 
                                mainTitle={t(settings.imageToReal.mainTitleKey)}
                                subtitle={t(settings.imageToReal.subtitleKey)}
                                uploaderCaption={t(settings.imageToReal.uploaderCaptionKey)}
                                uploaderDescription={t(settings.imageToReal.uploaderDescriptionKey)}
                                {...commonProps}
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                );
            case 'swap-style':
                return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="swap-style" {...motionProps}>
                            <SwapStyle 
                                {...settings.swapStyle} 
                                mainTitle={t(settings.swapStyle.mainTitleKey)}
                                subtitle={t(settings.swapStyle.subtitleKey)}
                                uploaderCaption={t(settings.swapStyle.uploaderCaptionKey)}
                                uploaderDescription={t(settings.swapStyle.uploaderDescriptionKey)}
                                {...commonProps}
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                );
            case 'mix-style':
                return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="mix-style" {...motionProps}>
                            <MixStyle 
                                {...settings.mixStyle} 
                                mainTitle={t(settings.mixStyle.mainTitleKey)}
                                subtitle={t(settings.mixStyle.subtitleKey)}
                                uploaderCaptionContent={t(settings.mixStyle.uploaderCaptionContentKey)}
                                uploaderDescriptionContent={t(settings.mixStyle.uploaderDescriptionContentKey)}
                                uploaderCaptionStyle={t(settings.mixStyle.uploaderCaptionStyleKey)}
                                uploaderDescriptionStyle={t(settings.mixStyle.uploaderDescriptionStyleKey)}
                                {...commonProps}
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                );
            case 'toy-model-creator':
                 return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="toy-model-creator" {...motionProps}>
                            <ToyModelCreator 
                                {...settings.toyModelCreator}
                                mainTitle={t(settings.toyModelCreator.mainTitleKey)}
                                subtitle={t(settings.toyModelCreator.subtitleKey)}
                                uploaderCaption={t(settings.toyModelCreator.uploaderCaptionKey)}
                                uploaderDescription={t(settings.toyModelCreator.uploaderDescriptionKey)}
                                {...commonProps}
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                );
            case 'avatar-creator':
                 return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="avatar-creator" {...motionProps}>
                            <AvatarCreator 
                                {...settings.avatarCreator}
                                mainTitle={t(settings.avatarCreator.mainTitleKey)}
                                subtitle={t(settings.avatarCreator.subtitleKey)}
                                uploaderCaption={t(settings.avatarCreator.uploaderCaptionKey)}
                                uploaderDescription={t(settings.avatarCreator.uploaderDescriptionKey)}
                                {...commonProps}
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                 );
             case 'baby-photo-creator':
                 return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="baby-photo-creator" {...motionProps}>
                            <BabyPhotoCreator 
                                {...settings.babyPhotoCreator}
                                mainTitle={t(settings.babyPhotoCreator.mainTitleKey)}
                                subtitle={t(settings.babyPhotoCreator.subtitleKey)}
                                uploaderCaption={t(settings.babyPhotoCreator.uploaderCaptionKey)}
                                uploaderDescription={t(settings.babyPhotoCreator.uploaderDescriptionKey)}
                                {...commonProps}
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                 );
            case 'image-interpolation':
                 return (
                    <Suspense fallback={<AppLoadingFallback />}>
                        <motion.div key="image-interpolation" {...motionProps}>
                            <ImageInterpolation 
                                {...settings.imageInterpolation}
                                mainTitle={t(settings.imageInterpolation.mainTitleKey)}
                                subtitle={t(settings.imageInterpolation.subtitleKey)}
                                uploaderCaptionInput={t(settings.imageInterpolation.uploaderCaptionInputKey)}
                                uploaderDescriptionInput={t(settings.imageInterpolation.uploaderDescriptionInputKey)}
                                uploaderCaptionOutput={t(settings.imageInterpolation.uploaderCaptionOutputKey)}
                                uploaderDescriptionOutput={t(settings.imageInterpolation.uploaderDescriptionOutputKey)}
                                uploaderCaptionReference={t(settings.imageInterpolation.uploaderCaptionReferenceKey)}
                                uploaderDescriptionReference={t(settings.imageInterpolation.uploaderDescriptionReferenceKey)}
                                {...commonProps}
                                appState={currentView.state} 
                            />
                        </motion.div>
                    </Suspense>
                 );
            default: // Fallback for any invalid view id in history
                 return (
                    <Home 
                        key="home-fallback"
                        onSelectApp={handleSelectApp} 
                        title={renderSmartlyWrappedTitle(t(settings.home.mainTitleKey), settings.home.useSmartTitleWrapping, settings.home.smartTitleWrapWords)}
                        subtitle={t(settings.home.subtitleKey)}
                        apps={settings.apps.map((app: AppConfig) => ({...app, title: t(app.titleKey), description: t(app.descriptionKey)}))}
                    />
                 );
        }
    };

    if (isLoading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-neutral-900">
                <LoadingSpinnerIcon className="animate-spin h-10 w-10 text-yellow-400" />
            </div>
        );
    }

    if (loginSettings?.enabled && !isLoggedIn) {
        return <LoginScreen />;
    }

    return (
        <main className="text-neutral-200 min-h-screen w-full relative">
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        fontFamily: '"Be Vietnam Pro", sans-serif',
                        background: 'rgba(38, 38, 38, 0.75)', /* bg-neutral-800 @ 75% */
                        backdropFilter: 'blur(8px)',
                        color: '#E5E5E5', /* text-neutral-200 */
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                    },
                    success: {
                        iconTheme: {
                            primary: '#FBBF24', // yellow-400
                            secondary: '#171717', // neutral-900
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: '#f87171', // red-400
                            secondary: '#171717', // neutral-900
                        },
                    },
                }}
            />
            <div className="absolute inset-0 bg-black/30 z-0" aria-hidden="true"></div>
            
            <div className="fixed top-4 left-4 z-20 flex items-center gap-2">
                {isLoggedIn && currentUser && <UserStatus />}
                <LanguageSwitcher />
            </div>
            <AppToolbar />

            <div className="relative z-10 w-full min-h-screen flex flex-row items-center justify-center px-4 pt-16 pb-24">
                <AnimatePresence mode="wait">
                   {renderContent()}
                </AnimatePresence>
            </div>
            
            <SearchModal
                isOpen={isSearchOpen}
                onClose={handleCloseSearch}
                onSelectApp={(appId) => {
                    handleSelectApp(appId);
                    handleCloseSearch();
                }}
                apps={settings ? settings.apps.map((app: AppConfig) => ({...app, title: t(app.titleKey), description: t(app.descriptionKey)})) : []}
            />
            <GalleryModal
                isOpen={isGalleryOpen}
                onClose={handleCloseGallery}
                images={sessionGalleryImages}
            />
             <InfoModal
                isOpen={isInfoOpen}
                onClose={handleCloseInfo}
            />
            <HistoryPanel
                isOpen={isHistoryPanelOpen}
                onClose={handleCloseHistoryPanel}
            />
            <ImageEditorModal 
                imageToEdit={imageToEdit}
                onClose={closeImageEditor}
            />
            <ImageLayoutModal
                isOpen={isImageLayoutModalOpen}
                onClose={closeImageLayoutModal}
            />
            <BeforeAfterModal
                isOpen={isBeforeAfterModalOpen}
                onClose={closeBeforeAfterModal}
            />
            {isLayerComposerMounted && (
                <LayerComposerModal
                    isOpen={isLayerComposerVisible}
                    onClose={closeLayerComposer}
                    onHide={hideLayerComposer}
                />
            )}
            <Footer />
        </main>
    );
}

export default App;