/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { ChangeEvent, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateFreeImage, editImageWithPrompt, analyzePromptForImageGenerationParams } from '../services/geminiService.ts';
import ActionablePolaroidCard from './ActionablePolaroidCard.tsx';
import Lightbox from './Lightbox.tsx';
import { 
    AppScreenHeader,
    handleFileUpload,
    useMediaQuery,
    ImageForZip,
    ResultsView,
    OptionsPanel,
    type FreeGenerationState,
    useLightbox,
    useVideoGeneration,
    processAndDownloadAll,
    embedJsonInPng,
    useAppControls,
    getInitialStateForApp,
} from './uiUtils.tsx';

interface FreeGenerationProps {
    mainTitle: string;
    subtitle: string;
    useSmartTitleWrapping: boolean;
    smartTitleWrapWords: number;
    uploaderCaption1: string;
    uploaderDescription1: string;
    uploaderCaption2: string;
    uploaderDescription2: string;
    addImagesToGallery: (images: string[]) => void;
    appState: FreeGenerationState;
    onStateChange: (newState: FreeGenerationState) => void;
    onReset: () => void;
    onGoBack: () => void;
    logGeneration: (appId: string, preGenState: any, thumbnailUrl: string) => void;
}

const NUMBER_OF_IMAGES_OPTIONS = ['1', '2', '3', '4'] as const;
const ASPECT_RATIO_OPTIONS = ['Giữ nguyên', '1:1', '2:3', '4:5', '9:16', '1:2', '3:2', '5:4', '16:9', '2:1'];

const FreeGeneration: React.FC<FreeGenerationProps> = (props) => {
    const { 
        uploaderCaption1, uploaderDescription1,
        uploaderCaption2, uploaderDescription2,
        addImagesToGallery,
        appState, onStateChange, onReset,
        logGeneration,
        ...headerProps
    } = props;
    
    const { t, settings } = useAppControls();
    const { videoTasks, generateVideo } = useVideoGeneration();
    const { lightboxIndex, openLightbox, closeLightbox, navigateLightbox } = useLightbox();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [localPrompt, setLocalPrompt] = useState(appState.options.prompt);

    useEffect(() => {
        setLocalPrompt(appState.options.prompt);
    }, [appState.options.prompt]);

    const lightboxImages = [appState.image1, appState.image2, ...appState.historicalImages].filter((img): img is string => !!img);

    const handleImage1Upload = (e: ChangeEvent<HTMLInputElement>) => {
        handleFileUpload(e, (imageDataUrl) => {
            onStateChange({
                ...appState,
                image1: imageDataUrl,
                generatedImages: [],
                historicalImages: [],
                error: null,
            });
            addImagesToGallery([imageDataUrl]);
        });
    };

    const handleImage2Upload = (e: ChangeEvent<HTMLInputElement>) => {
        handleFileUpload(e, (imageDataUrl) => {
             onStateChange({
                ...appState,
                image2: imageDataUrl,
                generatedImages: [],
                historicalImages: [],
                error: null,
            });
            addImagesToGallery([imageDataUrl]);
        });
    };
    
    const handleSaveImage1 = (newUrl: string) => {
        onStateChange({ ...appState, image1: newUrl });
        addImagesToGallery([newUrl]);
    };
    const handleSaveImage2 = (newUrl: string) => {
        onStateChange({ ...appState, image2: newUrl });
        addImagesToGallery([newUrl]);
    };

    const handleSaveGeneratedImage = (index: number) => (newUrl: string) => {
        const newGeneratedImages = [...appState.generatedImages];
        newGeneratedImages[index] = newUrl;
        const newHistoricalImages = [...appState.historicalImages, newUrl];
        onStateChange({
            ...appState,
            stage: 'results',
            generatedImages: newGeneratedImages,
            historicalImages: newHistoricalImages,
        });
        addImagesToGallery([newUrl]);
    };

    const handleOptionChange = (field: keyof FreeGenerationState['options'], value: string | boolean | number) => {
        onStateChange({
            ...appState,
            options: { ...appState.options, [field]: value }
        });
    };

    const handleGenerate = async () => {
        if (!appState.options.prompt) {
            onStateChange({ ...appState, error: "Vui lòng nhập prompt để tạo ảnh." });
            return;
        }
        
        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null, generatedImages: [] });

        try {
            let resultUrls: string[];
    
            // Case 1: Text-to-Image (Imagen) with prompt analysis
            if (!appState.image1) {
                console.log("Analyzing prompt for Free Generation...");
                const params = await analyzePromptForImageGenerationParams(appState.options.prompt);
    
                // Prompt overrides UI if it's not the default.
                const numImages = params.numberOfImages > 1 ? params.numberOfImages : appState.options.numberOfImages;
                const aspectRatio = params.aspectRatio !== '1:1' ? params.aspectRatio : appState.options.aspectRatio;

                console.log(`Generation params: num=${numImages}, ratio=${aspectRatio}, prompt="${params.refinedPrompt}"`);
                
                resultUrls = await generateFreeImage(
                    params.refinedPrompt,
                    numImages,
                    aspectRatio,
                    undefined,
                    undefined,
                    appState.options.removeWatermark
                );
            } else {
                // Case 2: Image-to-Image (Gemini Image Editing)
                resultUrls = await generateFreeImage(
                    appState.options.prompt, 
                    1, // Editing always produces 1 image
                    appState.options.aspectRatio, 
                    appState.image1, 
                    appState.image2, 
                    appState.options.removeWatermark
                );
            }

            const settingsToEmbed = {
                viewId: 'free-generation',
                state: { ...appState, stage: 'configuring', generatedImages: [], historicalImages: [], error: null },
            };
        
            const urlsWithMetadata = await Promise.all(
                resultUrls.map(url => embedJsonInPng(url, settingsToEmbed, settings.enableImageMetadata))
            );

            if (urlsWithMetadata.length > 0) {
                logGeneration('free-generation', preGenState, urlsWithMetadata[0]);
            }

            onStateChange({
                ...appState,
                stage: 'results',
                generatedImages: urlsWithMetadata,
                historicalImages: [...appState.historicalImages, ...urlsWithMetadata],
            });
            addImagesToGallery(urlsWithMetadata);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            onStateChange({ ...appState, stage: 'results', error: errorMessage });
        }
    };

    const handleRegeneration = async (index: number, prompt: string) => {
        const url = appState.generatedImages[index];
        if (!url) return;
        
        const originalGeneratedImages = [...appState.generatedImages];
        const preGenState = { ...appState };
        
        onStateChange({ ...appState, stage: 'generating', error: null });

        try {
            const resultUrl = await editImageWithPrompt(url, prompt);
            const settingsToEmbed = {
                viewId: 'free-generation',
                state: { ...appState, stage: 'configuring', generatedImages: [], historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            logGeneration('free-generation', preGenState, urlWithMetadata);
            
            const newGeneratedImages = [...originalGeneratedImages];
            newGeneratedImages[index] = urlWithMetadata;
            
            onStateChange({
                ...appState,
                stage: 'results',
                generatedImages: newGeneratedImages,
                historicalImages: [...appState.historicalImages, urlWithMetadata],
            });
            addImagesToGallery([urlWithMetadata]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            onStateChange({ ...appState, stage: 'results', error: errorMessage, generatedImages: originalGeneratedImages });
        }
    };
    
    const handleBackToOptions = () => {
        onStateChange({ ...appState, stage: 'configuring', error: null, generatedImages: [] });
    };
    
    const handleDownloadAll = () => {
        const inputImages: ImageForZip[] = [];
        if (appState.image1) {
            inputImages.push({ url: appState.image1, filename: 'anh-goc-1', folder: 'input' });
        }
        if (appState.image2) {
            inputImages.push({ url: appState.image2, filename: 'anh-goc-2', folder: 'input' });
        }
        
        processAndDownloadAll({
            inputImages,
            historicalImages: appState.historicalImages,
            videoTasks,
            zipFilename: 'ket-qua-tao-anh-tu-do.zip',
            baseOutputFilename: 'ket-qua',
        });
    };

    const Uploader = ({ id, onUpload, caption, description, currentImage, placeholderType }: any) => (
        <div className="flex flex-col items-center gap-4">
            <label htmlFor={id} className="cursor-pointer group transform hover:scale-105 transition-transform duration-300">
                 <ActionablePolaroidCard
                    type={currentImage ? 'multi-input' : 'uploader'}
                    caption={caption}
                    status="done"
                    mediaUrl={currentImage || undefined}
                    placeholderType={placeholderType}
                    onClick={currentImage ? () => openLightbox(lightboxImages.indexOf(currentImage)) : undefined}
                    onImageChange={id === 'free-gen-upload-1' ? handleSaveImage1 : handleSaveImage2}
                />
            </label>
            <input id={id} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={onUpload} />
            <p className="base-font font-bold text-neutral-300 text-center max-w-xs text-md">
                {description}
            </p>
        </div>
    );
    
    const isLoading = appState.stage === 'generating';

    return (
        <div className="flex flex-col items-center justify-center w-full h-full flex-1 min-h-0">
            <AnimatePresence>
                {(appState.stage === 'configuring') && (
                    <AppScreenHeader {...headerProps} />
                )}
            </AnimatePresence>

            {appState.stage === 'configuring' && (
                 <motion.div
                    className="flex flex-col items-center gap-8 w-full max-w-screen-2xl py-6 overflow-y-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="w-full overflow-x-auto pb-4">
                        <div className="flex flex-col md:flex-row items-center md:items-start justify-center gap-6 md:gap-8 w-full md:w-max mx-auto px-4">
                            <Uploader 
                                id="free-gen-upload-1"
                                onUpload={handleImage1Upload}
                                caption={uploaderCaption1}
                                description={uploaderDescription1}
                                currentImage={appState.image1}
                                placeholderType="magic"
                            />
                            <AnimatePresence>
                            {appState.image1 && (
                                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                                    <Uploader 
                                        id="free-gen-upload-2"
                                        onUpload={handleImage2Upload}
                                        caption={uploaderCaption2}
                                        description={uploaderDescription2}
                                        currentImage={appState.image2}
                                        placeholderType="magic"
                                    />
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </div>
                    </div>
                     
                    <OptionsPanel>
                        <h2 className="base-font font-bold text-2xl text-yellow-400 border-b border-yellow-400/20 pb-2">{t('freeGeneration_promptTitle')}</h2>
                        
                        <div className="bg-yellow-900/30 border border-yellow-400/50 rounded-lg p-3 my-4 text-sm text-neutral-300 space-y-1">
                            <div className="flex items-center gap-2 font-bold text-yellow-300">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span>{t('freeGeneration_tipsTitle')}</span>
                            </div>
                            <ul className="list-disc list-inside pl-2 space-y-1 base-font">
                                {t('freeGeneration_tips').map((tip: string, index: number) => (
                                    <li key={index} dangerouslySetInnerHTML={{ __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                ))}
                            </ul>
                        </div>

                        <div>
                            <textarea
                                id="prompt"
                                value={localPrompt}
                                onChange={(e) => setLocalPrompt(e.target.value)}
                                onBlur={() => {
                                    if (localPrompt !== appState.options.prompt) {
                                        handleOptionChange('prompt', localPrompt);
                                    }
                                }}
                                placeholder={t('freeGeneration_promptPlaceholder')}
                                className="form-input !h-32"
                                rows={5}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`transition-opacity duration-300 ${appState.image1 ? 'opacity-50' : 'opacity-100'}`}>
                                <label htmlFor="number-of-images" className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">
                                    {t('freeGeneration_numImagesLabel')}
                                </label>
                                <select
                                    id="number-of-images"
                                    value={appState.options.numberOfImages}
                                    onChange={(e) => handleOptionChange('numberOfImages', parseInt(e.target.value, 10))}
                                    className="form-input"
                                    disabled={!!appState.image1}
                                    aria-label={t('freeGeneration_numImagesAriaLabel')}
                                >
                                    {NUMBER_OF_IMAGES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                {appState.image1 && <p className="text-xs text-neutral-400 mt-1">{t('freeGeneration_editModeWarning')}</p>}
                            </div>
                             <div>
                                <label htmlFor="aspect-ratio" className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{t('common_aspectRatio')}</label>
                                <select
                                    id="aspect-ratio"
                                    value={appState.options.aspectRatio}
                                    onChange={(e) => handleOptionChange('aspectRatio', e.target.value)}
                                    className="form-input"
                                >
                                    {ASPECT_RATIO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                {!appState.image1 && <p className="text-xs text-neutral-400 mt-1">{t('freeGeneration_aspectRatioNote')}</p>}
                            </div>
                        </div>

                        <div className="flex items-center pt-2">
                            <input
                                type="checkbox"
                                id="remove-watermark-free"
                                checked={appState.options.removeWatermark}
                                onChange={(e) => handleOptionChange('removeWatermark', e.target.checked)}
                                className="h-4 w-4 rounded border-neutral-500 bg-neutral-700 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-neutral-800"
                                aria-label={t('common_removeWatermark')}
                            />
                            <label htmlFor="remove-watermark-free" className="ml-3 block text-sm font-medium text-neutral-300">
                                {t('common_removeWatermark')}
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-4 pt-4">
                             { (appState.image1 || appState.image2) && <button onClick={() => { onStateChange({...appState, image1: null, image2: null}) }} className="btn btn-secondary">
                                {t('common_deleteImages')}
                            </button> }
                            <button onClick={handleGenerate} className="btn btn-primary" disabled={isLoading || !appState.options.prompt.trim()}>
                                {isLoading ? t('common_creating') : t('freeGeneration_createButton')}
                            </button>
                        </div>
                    </OptionsPanel>
                </motion.div>
            )}

            {(appState.stage === 'generating' || appState.stage === 'results') && (
                <ResultsView
                    stage={appState.stage}
                    originalImage={appState.image1}
                    onOriginalClick={() => appState.image1 && openLightbox(lightboxImages.indexOf(appState.image1))}
                    error={appState.error}
                    isMobile={isMobile}
                    actions={(
                        <>
                            {appState.historicalImages.length > 0 && !appState.error && (
                                <button onClick={handleDownloadAll} className="btn btn-primary">{t('common_downloadAll')}</button>
                            )}
                            <button onClick={handleBackToOptions} className="btn btn-secondary">{t('common_edit')}</button>
                            <button onClick={onReset} className="btn btn-secondary !bg-red-500/20 !border-red-500/80 hover:!bg-red-500 hover:!text-white">{t('common_startOver')}</button>
                        </>
                    )}
                >
                    {appState.image2 && (
                        <motion.div key="image2-result" className="w-full md:w-auto flex-shrink-0" whileHover={{ scale: 1.05, zIndex: 10 }} transition={{ duration: 0.2 }}>
                            <ActionablePolaroidCard type="multi-input" caption={t('freeGeneration_originalImage2Caption')} status="done" mediaUrl={appState.image2} isMobile={isMobile} onClick={() => appState.image2 && openLightbox(lightboxImages.indexOf(appState.image2))} onImageChange={handleSaveImage2} />
                        </motion.div>
                    )}
                    {
                       isLoading ? 
                        Array.from({ length: appState.image1 ? 1 : appState.options.numberOfImages }).map((_, index) => (
                             <motion.div
                                className="w-full md:w-auto flex-shrink-0"
                                key={`pending-${index}`}
                                initial={{ opacity: 0, scale: 0.5, y: 100 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.2 + index * 0.1 }}
                            >
                                <ActionablePolaroidCard type="output" caption={t('freeGeneration_resultCaption', index + 1)} status="pending" />
                            </motion.div>
                        ))
                       :
                       appState.generatedImages.map((url, index) => (
                             <motion.div
                                className="w-full md:w-auto flex-shrink-0"
                                key={url}
                                initial={{ opacity: 0, scale: 0.5, y: 100 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.2 + index * 0.1 }}
                                whileHover={{ scale: 1.05, zIndex: 10 }}
                            >
                                <ActionablePolaroidCard
                                    type="output"
                                    caption={t('freeGeneration_resultCaption', index + 1)}
                                    status={'done'}
                                    mediaUrl={url}
                                    onGenerateVideoFromPrompt={(prompt) => generateVideo(url, prompt)}
                                    onImageChange={handleSaveGeneratedImage(index)}
                                    onRegenerate={(prompt) => handleRegeneration(index, prompt)}
                                    regenerationTitle={t('freeGeneration_regenTitle')}
                                    regenerationDescription={t('freeGeneration_regenDescription')}
                                    regenerationPlaceholder={t('freeGeneration_regenPlaceholder')}
                                    onClick={() => openLightbox(lightboxImages.indexOf(url))}
                                    isMobile={isMobile}
                                />
                            </motion.div>
                       ))
                    }
                    {appState.historicalImages.map(sourceUrl => {
                        const videoTask = videoTasks[sourceUrl];
                        if (!videoTask) return null;
                        return (
                            <motion.div
                                className="w-full md:w-auto flex-shrink-0"
                                key={`${sourceUrl}-video`}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                            >
                                <ActionablePolaroidCard
                                    type="output"
                                    caption={t('common_video')}
                                    status={videoTask.status}
                                    mediaUrl={videoTask.resultUrl}
                                    error={videoTask.error}
                                    onClick={videoTask.resultUrl ? () => openLightbox(lightboxImages.indexOf(videoTask.resultUrl!)) : undefined}
                                    isMobile={isMobile}
                                />
                            </motion.div>
                        );
                    })}
                     {appState.error && !isLoading && (
                         <motion.div
                            className="w-full md:w-auto flex-shrink-0"
                            key="error-card"
                            initial={{ opacity: 0, scale: 0.5, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                        >
                            <ActionablePolaroidCard
                                type="output"
                                caption={t('common_error')}
                                status="error"
                                error={appState.error}
                                isMobile={isMobile}
                            />
                        </motion.div>
                    )}

                </ResultsView>
            )}

            <Lightbox
                images={lightboxImages}
                selectedIndex={lightboxIndex}
                onClose={closeLightbox}
                onNavigate={navigateLightbox}
            />
        </div>
    );
};

export default FreeGeneration;