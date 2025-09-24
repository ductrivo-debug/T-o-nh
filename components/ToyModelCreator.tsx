/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { ChangeEvent, useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateToyModelImage, editImageWithPrompt } from '../services/geminiService.ts';
import ActionablePolaroidCard from './ActionablePolaroidCard.tsx';
import Lightbox from './Lightbox.tsx';
import { 
    AppScreenHeader,
    ImageUploader,
    ResultsView,
    ImageForZip,
    AppOptionsLayout,
    OptionsPanel,
    type ToyModelCreatorState,
    handleFileUpload,
    useLightbox,
    useVideoGeneration,
    processAndDownloadAll,
    getInitialStateForApp,
    SearchableSelect,
    useAppControls,
    embedJsonInPng,
} from './uiUtils.tsx';

interface ToyModelCreatorProps {
    mainTitle: string;
    subtitle: string;
    useSmartTitleWrapping: boolean;
    smartTitleWrapWords: number;
    uploaderCaption: string;
    uploaderDescription: string;
    addImagesToGallery: (images: string[]) => void;
    appState: ToyModelCreatorState;
    onStateChange: (newState: ToyModelCreatorState) => void;
    onReset: () => void;
    onGoBack: () => void;
    logGeneration: (appId: string, preGenState: any, thumbnailUrl: string) => void;
}

const ToyModelCreator: React.FC<ToyModelCreatorProps> = (props) => {
    const { 
        uploaderCaption, uploaderDescription, addImagesToGallery,
        appState, onStateChange, onReset,
        logGeneration,
        ...headerProps
    } = props;
    
    const { t, settings } = useAppControls();
    const { lightboxIndex, openLightbox, closeLightbox, navigateLightbox } = useLightbox();
    const { videoTasks, generateVideo } = useVideoGeneration();
    const [localNotes, setLocalNotes] = useState(appState.options.notes);

    useEffect(() => {
        setLocalNotes(appState.options.notes);
    }, [appState.options.notes]);

    const lightboxImages = [appState.uploadedImage, ...appState.historicalImages].filter((img): img is string => !!img);
    const ASPECT_RATIO_OPTIONS = t('aspectRatioOptions');

    // --- Concept Definitions from Translations ---
    const CONCEPTS_DATA = useMemo(() => {
        const concepts = t('toyModelCreator_concepts');
        return {
          desktop_model: {
            name: concepts.desktop_model.name,
            options: [
              { id: 'computerType', label: concepts.desktop_model.options.computerType, type: 'searchable-select', choices: concepts.desktop_model.choices.computerType },
              { 
                id: 'softwareType', 
                label: concepts.desktop_model.options.softwareType, 
                type: 'searchable-select', 
                getChoices: (options: ToyModelCreatorState['options']) => (
                  options.computerType.toLowerCase().includes(t('toyModelCreator_concepts.desktop_model.tabletIdentifier')) 
                    ? concepts.desktop_model.choices.softwareType_tablet 
                    : concepts.desktop_model.choices.softwareType_desktop
                ) 
              },
              { id: 'boxType', label: concepts.desktop_model.options.boxType, type: 'searchable-select', choices: concepts.desktop_model.choices.boxType },
              { id: 'background', label: concepts.desktop_model.options.background, type: 'searchable-select', choices: concepts.desktop_model.choices.background },
            ],
          },
          crafting_model: {
            name: concepts.crafting_model.name,
            options: [
              { id: 'modelType', label: concepts.crafting_model.options.modelType, type: 'searchable-select', choices: concepts.crafting_model.choices.modelType },
              { id: 'blueprintType', label: concepts.crafting_model.options.blueprintType, type: 'searchable-select', choices: concepts.crafting_model.choices.blueprintType },
              { id: 'background', label: concepts.crafting_model.options.background, type: 'searchable-select', choices: concepts.crafting_model.choices.background },
              { id: 'characterMood', label: concepts.crafting_model.options.characterMood, type: 'searchable-select', choices: concepts.crafting_model.choices.characterMood },
            ]
          },
          keychain: {
            name: concepts.keychain.name,
            options: [
              { id: 'keychainMaterial', label: concepts.keychain.options.keychainMaterial, type: 'searchable-select', choices: concepts.keychain.choices.keychainMaterial },
              { id: 'keychainStyle', label: concepts.keychain.options.keychainStyle, type: 'searchable-select', choices: concepts.keychain.choices.keychainStyle },
              { id: 'accompanyingItems', label: concepts.keychain.options.accompanyingItems, type: 'searchable-select', choices: concepts.keychain.choices.accompanyingItems },
              { id: 'deskSurface', label: concepts.keychain.options.deskSurface, type: 'searchable-select', choices: concepts.keychain.choices.deskSurface },
            ]
          },
          gachapon: {
            name: concepts.gachapon.name,
            options: [
              { id: 'capsuleColor', label: concepts.gachapon.options.capsuleColor, type: 'searchable-select', choices: concepts.gachapon.choices.capsuleColor },
              { id: 'modelFinish', label: concepts.gachapon.options.modelFinish, type: 'searchable-select', choices: concepts.gachapon.choices.modelFinish },
              { id: 'capsuleContents', label: concepts.gachapon.options.capsuleContents, type: 'searchable-select', choices: concepts.gachapon.choices.capsuleContents },
              { id: 'displayLocation', label: concepts.gachapon.options.displayLocation, type: 'searchable-select', choices: concepts.gachapon.choices.displayLocation },
            ]
          },
          miniature: {
            name: concepts.miniature.name,
            options: [
              { id: 'miniatureMaterial', label: concepts.miniature.options.miniatureMaterial, type: 'searchable-select', choices: concepts.miniature.choices.miniatureMaterial },
              { id: 'baseMaterial', label: concepts.miniature.options.baseMaterial, type: 'searchable-select', choices: concepts.miniature.choices.baseMaterial },
              { id: 'baseShape', label: concepts.miniature.options.baseShape, type: 'searchable-select', choices: concepts.miniature.choices.baseShape },
              { id: 'lightingStyle', label: concepts.miniature.options.lightingStyle, type: 'searchable-select', choices: concepts.miniature.choices.lightingStyle },
            ]
          },
          pokemon_model: {
            name: concepts.pokemon_model.name,
            options: [
              { id: 'pokeballType', label: concepts.pokemon_model.options.pokeballType, type: 'searchable-select', choices: concepts.pokemon_model.choices.pokeballType },
              { id: 'evolutionDisplay', label: concepts.pokemon_model.options.evolutionDisplay, type: 'searchable-select', choices: concepts.pokemon_model.choices.evolutionDisplay },
              { id: 'modelStyle', label: concepts.pokemon_model.options.modelStyle, type: 'searchable-select', choices: concepts.pokemon_model.choices.modelStyle },
            ]
          }
        };
    }, [t]);

    const handleImageSelectedForUploader = (imageDataUrl: string) => {
        onStateChange({
            ...appState,
            stage: 'configuring',
            uploadedImage: imageDataUrl,
            generatedImage: null,
            historicalImages: [],
            error: null,
        });
        addImagesToGallery([imageDataUrl]);
    };

    const handleImageUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleFileUpload(e, handleImageSelectedForUploader);
    }, [appState, onStateChange]);

    const handleUploadedImageChange = (newUrl: string) => {
        onStateChange({ ...appState, uploadedImage: newUrl });
        addImagesToGallery([newUrl]);
    };

    const handleGeneratedImageChange = (newUrl: string) => {
        const newHistorical = [...appState.historicalImages, newUrl];
        onStateChange({ ...appState, stage: 'results', generatedImage: newUrl, historicalImages: newHistorical });
        addImagesToGallery([newUrl]);
    };
    
    const handleOptionChange = (field: keyof ToyModelCreatorState['options'], value: string | boolean) => {
        onStateChange({ ...appState, options: { ...appState.options, [field]: value } });
    };

    const handleConceptChange = (newConceptId: string) => {
        const initialAppState = getInitialStateForApp('toy-model-creator') as ToyModelCreatorState;
        onStateChange({
            ...appState,
            concept: newConceptId,
            options: initialAppState.options, // Reset options to default for the app
        });
    };
    
    const executeInitialGeneration = async () => {
        if (!appState.uploadedImage) return;

        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null });

        try {
            // No need to transform options, the service handles '' and 'Tự động' correctly
            const resultUrl = await generateToyModelImage(appState.uploadedImage, appState.concept, appState.options);
            const settingsToEmbed = {
                viewId: 'toy-model-creator',
                state: { ...appState, stage: 'configuring', generatedImage: null, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            logGeneration('toy-model-creator', preGenState, urlWithMetadata);
            onStateChange({
                ...appState,
                stage: 'results',
                generatedImage: urlWithMetadata,
                historicalImages: [...appState.historicalImages, urlWithMetadata],
            });
            addImagesToGallery([urlWithMetadata]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            onStateChange({ ...appState, stage: 'results', error: errorMessage });
        }
    };
    
    const handleRegeneration = async (prompt: string) => {
        if (!appState.generatedImage) return;
        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null });
        try {
            const resultUrl = await editImageWithPrompt(appState.generatedImage, prompt);
            const settingsToEmbed = {
                viewId: 'toy-model-creator',
                state: { ...appState, stage: 'configuring', generatedImage: null, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            logGeneration('toy-model-creator', preGenState, urlWithMetadata);
            onStateChange({
                ...appState,
                stage: 'results',
                generatedImage: urlWithMetadata,
                historicalImages: [...appState.historicalImages, urlWithMetadata],
            });
            addImagesToGallery([urlWithMetadata]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            onStateChange({ ...appState, stage: 'results', error: errorMessage });
        }
    };

    const handleBackToOptions = () => {
        onStateChange({ ...appState, stage: 'configuring', error: null });
    };

    const handleDownloadAll = () => {
        const inputImages: ImageForZip[] = [];
        if (appState.uploadedImage) {
            inputImages.push({ url: appState.uploadedImage, filename: 'anh-goc', folder: 'input' });
        }
        processAndDownloadAll({
            inputImages,
            historicalImages: appState.historicalImages,
            videoTasks,
            zipFilename: `mo-hinh-${appState.concept}.zip`,
            baseOutputFilename: 'mo-hinh',
        });
    };
    
    const renderOption = (option: any) => {
        const { id, label, type } = option;
        const value = appState.options[id as keyof typeof appState.options] as string;
        
        if (type === 'text-input') {
            return (
                <div key={id} className="md:col-span-2">
                    <label htmlFor={id} className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{label}</label>
                    <input
                        id={id}
                        type="text"
                        value={value}
                        onChange={(e) => handleOptionChange(id, e.target.value)}
                        className="form-input"
                        placeholder="Ví dụ: Pikachu (giúp AI nhận diện tiến hoá)"
                    />
                </div>
            );
        }
        
        if (type === 'searchable-select') {
             const choices = typeof option.getChoices === 'function' ? option.getChoices(appState.options) : option.choices;
            return (
                <SearchableSelect
                    key={id}
                    id={id}
                    label={label}
                    options={choices}
                    value={value}
                    onChange={(newValue) => handleOptionChange(id, newValue)}
                    placeholder={t('common_auto')}
                />
            );
        }
        return null;
    };
    
    const isLoading = appState.stage === 'generating';
    const currentConceptData = CONCEPTS_DATA[appState.concept as keyof typeof CONCEPTS_DATA];

    return (
        <div className="flex flex-col items-center justify-center w-full h-full flex-1 min-h-0">
            <AnimatePresence>
                {(appState.stage === 'idle' || appState.stage === 'configuring') && (<AppScreenHeader {...headerProps} />)}
            </AnimatePresence>

            <div className="flex flex-col items-center justify-center w-full flex-1">
                {appState.stage === 'idle' && (
                    <ImageUploader
                        onImageChange={handleImageSelectedForUploader}
                        uploaderCaption={uploaderCaption}
                        uploaderDescription={uploaderDescription}
                        placeholderType="magic"
                    />
                )}

                {appState.stage === 'configuring' && appState.uploadedImage && (
                    <AppOptionsLayout>
                        <div className="flex-shrink-0">
                            <ActionablePolaroidCard type="content-input" mediaUrl={appState.uploadedImage} caption={t('common_originalImage')} status="done" onClick={() => openLightbox(0)} onImageChange={handleUploadedImageChange} />
                        </div>
                        <OptionsPanel>
                            <h2 className="base-font font-bold text-2xl text-yellow-400 border-b border-yellow-400/20 pb-2">{t('toyModelCreator_optionsTitle')}</h2>
                            <div>
                                <label className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{t('toyModelCreator_conceptLabel')}</label>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                     {/* FIX: Changed destructuring to handle 'any' type from translation and cast to get 'name' property. */}
                                     {Object.entries(CONCEPTS_DATA).map(([id, data]) => {
                                        const { name } = data as { name: string };
                                        const isSelected = appState.concept === id;
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => handleConceptChange(id)}
                                                role="radio"
                                                aria-checked={isSelected}
                                                className={`base-font font-bold p-3 rounded-md text-sm text-center transition-all duration-200 ${
                                                    isSelected
                                                    ? 'bg-yellow-400 text-black ring-2 ring-yellow-300 scale-105'
                                                    : 'bg-white/10 text-neutral-300 hover:bg-white/20'
                                                }`}
                                            >
                                                {name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentConceptData.options.map(renderOption)}
                            </div>
                            <div>
                                <label htmlFor="aspectRatio-toy" className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{t('common_aspectRatio')}</label>
                                <select id="aspectRatio-toy" value={appState.options.aspectRatio} onChange={(e) => handleOptionChange('aspectRatio', e.target.value)} className="form-input">
                                    {ASPECT_RATIO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="notes" className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{t('common_additionalNotes')}</label>
                                <textarea
                                    id="notes"
                                    value={localNotes}
                                    onChange={(e) => setLocalNotes(e.target.value)}
                                    onBlur={() => {
                                        if (localNotes !== appState.options.notes) {
                                            handleOptionChange('notes', localNotes);
                                        }
                                    }}
                                    placeholder={t('toyModelCreator_notesPlaceholder')}
                                    className="form-input h-24"
                                />
                            </div>
                             <div className="flex items-center pt-2">
                                <input
                                    type="checkbox"
                                    id="remove-watermark-toy"
                                    checked={appState.options.removeWatermark}
                                    onChange={(e) => handleOptionChange('removeWatermark', e.target.checked)}
                                    className="h-4 w-4 rounded border-neutral-500 bg-neutral-700 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-neutral-800"
                                    aria-label={t('common_removeWatermark')}
                                />
                                <label htmlFor="remove-watermark-toy" className="ml-3 block text-sm font-medium text-neutral-300">{t('common_removeWatermark')}</label>
                            </div>
                            <div className="flex items-center justify-end gap-4 pt-4">
                                <button onClick={onReset} className="btn btn-secondary">{t('common_changeImage')}</button>
                                <button onClick={executeInitialGeneration} className="btn btn-primary" disabled={isLoading}>{isLoading ? t('common_creating') : t('toyModelCreator_createButton')}</button>
                            </div>
                        </OptionsPanel>
                    </AppOptionsLayout>
                )}
            </div>

            {(appState.stage === 'generating' || appState.stage === 'results') && (
                <ResultsView
                    stage={appState.stage}
                    originalImage={appState.uploadedImage}
                    onOriginalClick={() => openLightbox(0)}
                    error={appState.error}
                    actions={
                        <>
                            {appState.generatedImage && !appState.error && (<button onClick={handleDownloadAll} className="btn btn-primary">{t('common_downloadAll')}</button>)}
                            <button onClick={handleBackToOptions} className="btn btn-secondary">{t('common_editOptions')}</button>
                            <button onClick={onReset} className="btn btn-secondary !bg-red-500/20 !border-red-500/80 hover:!bg-red-500 hover:!text-white">{t('common_startOver')}</button>
                        </>
                    }
                >
                    <motion.div
                        className="w-full md:w-auto flex-shrink-0"
                        key="generated-toy"
                        initial={{ opacity: 0, scale: 0.5, y: 100 }}
                        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.15 }}
                    >
                        <ActionablePolaroidCard
                            type="output"
                            caption={currentConceptData.name}
                            status={isLoading ? 'pending' : (appState.error ? 'error' : 'done')}
                            mediaUrl={appState.generatedImage ?? undefined}
                            error={appState.error ?? undefined}
                            onImageChange={handleGeneratedImageChange}
                            onRegenerate={handleRegeneration}
                            onGenerateVideoFromPrompt={(prompt) => appState.generatedImage && generateVideo(appState.generatedImage, prompt)}
                            regenerationTitle={t('toyModelCreator_regenTitle')}
                            regenerationPlaceholder={t('toyModelCreator_regenPlaceholder')}
                            onClick={!appState.error && appState.generatedImage ? () => openLightbox(lightboxImages.indexOf(appState.generatedImage!)) : undefined}
                        />
                    </motion.div>
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
                                />
                            </motion.div>
                        );
                    })}
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

export default ToyModelCreator;
