
"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploadArea } from "@/components/file-upload-area";
import { useToast } from "@/hooks/use-toast";
import { calculateAtsScore, type CalculateAtsScoreInput, type CalculateAtsScoreOutput } from "@/ai/flows/calculate-ats-score";
import type { ResumeFile, AtsScoreResult } from "@/lib/types";
import { AtsScoreTable } from "@/components/ats-score-table";
import { AtsFeedbackModal } from "@/components/ats-feedback-modal";
import { BarChartBig, Loader2, ScanSearch, BrainCircuit, ServerOff, ListFilter, Trash2, Trash } from "lucide-react";
import { LoadingIndicator } from "@/components/loading-indicator";
import { useLoading } from "@/contexts/loading-context";
import { useAuth } from "@/contexts/auth-context";
import { saveMultipleAtsScoreResults, getAtsScoreResults, deleteAtsScoreResult, deleteAllAtsScoreResults } from "@/services/firestoreService";
import { db as firestoreDb } from "@/lib/firebase/config"; // Import db to check availability
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_FILES_ATS = 10;
type SortOption = 'score-desc' | 'score-asc' | 'date-desc';


export default function AtsScoreFinderPage() {
  const { setIsPageLoading: setAppIsLoading } = useLoading();
  const { currentUser } = useAuth();

  const [uploadedResumeFiles, setUploadedResumeFiles] = useState<ResumeFile[]>([]);
  const [atsResults, setAtsResults] = useState<AtsScoreResult[]>([]);
  const [isProcessingAts, setIsProcessingAts] = useState<boolean>(false);
  const [isLoadingResultsFromDB, setIsLoadingResultsFromDB] = useState<boolean>(true);
  const [selectedResultForModal, setSelectedResultForModal] = useState<AtsScoreResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<SortOption>('score-desc');
  const [resultToDelete, setResultToDelete] = useState<AtsScoreResult | null>(null);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState<boolean>(false);

  const { toast } = useToast();
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement | null>(null);

  const isFirestoreAvailable = !!firestoreDb;

  useEffect(() => {
    setAppIsLoading(false);
    if (currentUser && isFirestoreAvailable) {
      setIsLoadingResultsFromDB(true);
      getAtsScoreResults()
        .then(results => setAtsResults(results))
        .catch(err => {
          let description = "Could not load saved ATS results.";
          if (err.code === 'failed-precondition') {
            description = "Error loading ATS results. This may be a temporary problem. Please try again later.";
            console.error(
              "Firestore Error (getAtsScoreResults): The query requires an index. " +
              "Please create the required composite index in your Firebase Firestore console. " +
              "The original error message may contain a direct link to create it: ", err.message
            );
          } else {
            console.error("Error fetching ATS results:", err);
            description = String(err.message || err).substring(0,100);
          }
          toast({ title: "Error Loading ATS Results", description, variant: "destructive" });
        })
        .finally(() => setIsLoadingResultsFromDB(false));
    } else if (!currentUser || !isFirestoreAvailable) {
        setIsLoadingResultsFromDB(false);
        setAtsResults([]);
    }
  }, [currentUser, toast, setAppIsLoading, isFirestoreAvailable]);

  useEffect(() => {
    if (uploadedResumeFiles.length > 0 && !isProcessingAts && analyzeButtonRef.current) {
      const timer = setTimeout(() => {
        analyzeButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [uploadedResumeFiles, isProcessingAts]);

  useEffect(() => {
    const shouldScroll = isProcessingAts || isLoadingResultsFromDB || (!isProcessingAts && !isLoadingResultsFromDB && atsResults.length > 0);
    if (shouldScroll && resultsSectionRef.current) {
      const timer = setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isProcessingAts, isLoadingResultsFromDB, atsResults]);
  
  const sortedAtsResults = useMemo(() => {
    return [...atsResults].sort((a, b) => {
      switch (sortOption) {
        case 'score-asc':
          return a.atsScore - b.atsScore;
        case 'date-desc':
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        case 'score-desc':
        default:
          return b.atsScore - a.atsScore;
      }
    });
  }, [atsResults, sortOption]);

  const handleResumesUpload = useCallback(async (files: File[]) => {
    if (!currentUser?.uid) {
      toast({ title: "Not Authenticated", description: "Please log in to upload resumes.", variant: "destructive" });
      return;
    }
    if (files.length > MAX_FILES_ATS) {
        toast({
            title: "Too many files",
            description: `Please upload a maximum of ${MAX_FILES_ATS} resumes at a time for ATS scoring.`,
            variant: "destructive",
        });
        return;
    }
    const newResumeFilesPromises = files.map(async (file) => {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
      return { id: crypto.randomUUID(), file, dataUri, name: file.name };
    });
    try {
      const newResumeFiles = await Promise.all(newResumeFilesPromises);
      setUploadedResumeFiles(newResumeFiles);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Error processing resume files", description: message.substring(0,100), variant: "destructive" });
    }
  }, [toast, currentUser?.uid]);

  const handleAnalyzeResumes = useCallback(async () => {
    if (!currentUser?.uid || !isFirestoreAvailable) {
      toast({ title: "Operation Unavailable", description: "Cannot analyze resumes. Please log in and ensure database is connected.", variant: "destructive" });
      return;
    }
    if (uploadedResumeFiles.length === 0) {
      toast({ title: "No Resumes Uploaded", description: "Please upload resume files to analyze.", variant: "destructive" });
      return;
    }

    setIsProcessingAts(true);
    const aiResultsToSave: Array<Omit<AtsScoreResult, 'id' | 'userId' | 'createdAt'>> = [];
    let filesProcessedSuccessfully = 0;

    const processingPromises = uploadedResumeFiles.map(async (resumeFile) => {
      try {
        const input: CalculateAtsScoreInput = {
          resumeDataUri: resumeFile.dataUri,
          originalResumeName: resumeFile.name,
        };
        const output: CalculateAtsScoreOutput = await calculateAtsScore(input);
        
        aiResultsToSave.push({
          resumeId: resumeFile.id, // keep original client-side ID for reference
          resumeName: resumeFile.name,
          candidateName: output.candidateName,
          atsScore: output.atsScore,
          atsFeedback: output.atsFeedback,
          resumeDataUri: resumeFile.dataUri,
        });
        filesProcessedSuccessfully++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error during ATS analysis.";
        console.error(`Failed to process ${resumeFile.name}: ${errorMessage}`);
        toast({
          title: `Analysis Failed for ${resumeFile.name}`,
          description: `Could not get ATS score. ${errorMessage.substring(0,100)}`,
          variant: "destructive",
        });
      }
    });

    await Promise.all(processingPromises);
    
    if (aiResultsToSave.length > 0) {
        try {
            const savedDbResults = await saveMultipleAtsScoreResults(aiResultsToSave);
            setAtsResults(prevResults => [...savedDbResults, ...prevResults]);
            toast({
                title: "ATS Analysis Complete & Saved",
                description: `${savedDbResults.length} of ${uploadedResumeFiles.length} resumes processed and saved.`,
            });
        } catch (dbError) {
            const message = dbError instanceof Error ? dbError.message : String(dbError);
            toast({ title: "Failed to Save ATS Results", description: `AI analysis complete, but could not save to database: ${message.substring(0,100)}`, variant: "destructive"});
        }
    } else if (uploadedResumeFiles.length > 0 && filesProcessedSuccessfully === 0) {
         toast({
            title: "ATS Analysis Failed",
            description: "No resumes could be processed successfully.",
            variant: "destructive"
        });
    }
    
    setIsProcessingAts(false);
    setUploadedResumeFiles([]);

  }, [uploadedResumeFiles, toast, currentUser?.uid, isFirestoreAvailable]);

  const handleViewInsights = (result: AtsScoreResult) => {
    setSelectedResultForModal(result);
    setIsModalOpen(true);
  };
  
  const handleOpenDeleteDialog = (result: AtsScoreResult) => {
    setResultToDelete(result);
  };

  const handleConfirmDelete = async () => {
    if (!resultToDelete) return;

    try {
      await deleteAtsScoreResult(resultToDelete.id);
      setAtsResults(prev => prev.filter(r => r.id !== resultToDelete.id));
      toast({
        title: "Result Deleted",
        description: `The result for "${resultToDelete.resumeName}" has been deleted.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Deletion Failed",
        description: message.substring(0, 100),
        variant: "destructive",
      });
    } finally {
      setResultToDelete(null);
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (!currentUser?.uid || !isFirestoreAvailable) {
      toast({ title: "Operation Unavailable", description: "Cannot delete results. Please log in and ensure database is connected.", variant: "destructive" });
      return;
    }

    try {
      await deleteAllAtsScoreResults();
      setAtsResults([]);
      toast({
        title: "All Results Deleted",
        description: "All saved ATS score results have been permanently deleted.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Deletion Failed",
        description: `Could not delete all results: ${message.substring(0, 100)}`,
        variant: "destructive",
      });
    } finally {
      setIsDeleteAllDialogOpen(false);
    }
  };

  const isProcessing = isProcessingAts || isLoadingResultsFromDB;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <Card className="mb-8 bg-gradient-to-r from-primary/5 via-background to-background border-primary/20 shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-primary flex items-center">
            <BarChartBig className="w-7 h-7 mr-3" /> ATS Score Analyzer
          </CardTitle>
          <CardDescription>
            Upload resumes to analyze their compatibility with Applicant Tracking Systems. Results are saved to your account.
          </CardDescription>
        </CardHeader>
      </Card>

      {!isFirestoreAvailable && (
        <Card className="shadow-lg border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center"><ServerOff className="w-5 h-5 mr-2" /> Database Not Connected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">The application could not connect to the database. Data saving and loading features are disabled. Please ensure Firebase is configured correctly.</p>
          </CardContent>
        </Card>
      )}

      {!currentUser && isFirestoreAvailable && (
        <Card className="shadow-lg">
            <CardContent className="pt-6 text-center">
                <p className="text-lg text-muted-foreground">Please <a href="/login" className="text-primary underline">log in</a> to use the ATS Score Analyzer and save your results.</p>
            </CardContent>
        </Card>
      )}

      {currentUser && isFirestoreAvailable && (
        <>
          <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center text-xl font-headline">
                Upload Resumes
              </CardTitle>
              <CardDescription>
                Upload one or more resume files (PDF, DOCX, TXT). Max 5MB each. Up to {MAX_FILES_ATS} files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileUploadArea
                onFilesUpload={handleResumesUpload}
                acceptedFileTypes={{
                  "application/pdf": [".pdf"],
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                  "text/plain": [".txt"],
                  "application/msword": [".doc"],
                }}
                multiple
                label={`PDF, DOCX, DOC, TXT files up to 5MB each (max ${MAX_FILES_ATS} files)`}
                id="ats-resume-upload"
                maxSizeInBytes={MAX_FILE_SIZE_BYTES}
              />
              <Button
                ref={analyzeButtonRef}
                onClick={handleAnalyzeResumes}
                disabled={isProcessingAts || uploadedResumeFiles.length === 0 || isLoadingResultsFromDB}
                size="lg"
                className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground shadow-md hover:shadow-lg transition-all"
              >
                {isProcessingAts ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <ScanSearch className="w-5 h-5 mr-2" />
                )}
                Find ATS Score
              </Button>
            </CardContent>
          </Card>

          <div ref={resultsSectionRef}>
            {isProcessing && (
              <Card className="shadow-lg">
                <CardContent className="pt-6">
                    <LoadingIndicator stage={"screening"} />
                </CardContent>
              </Card>
            )}

            {!isProcessing && atsResults.length > 0 && (
              <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
                <CardHeader>
                  <div className="flex justify-between items-center">
                     <div className="flex-1">
                      <CardTitle className="text-xl font-headline text-primary flex items-center">
                        <BrainCircuit className="w-6 h-6 mr-2" /> Saved ATS Score Results
                      </CardTitle>
                      <CardDescription>
                        Previously analyzed and saved resumes.
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDeleteAllDialogOpen(true)}
                            disabled={atsResults.length === 0 || isProcessing}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/50"
                            aria-label="Delete all results"
                            >
                            <Trash className="w-4 h-4 mr-2" />
                            Delete All
                        </Button>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isProcessing}>
                            <ListFilter className="w-4 h-4 mr-2" />
                            Sort
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSortOption('score-desc')}>
                            Highest Score
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortOption('score-asc')}>
                            Lowest Score
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortOption('date-desc')}>
                            Most Recent
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <AtsScoreTable results={sortedAtsResults} onViewInsights={handleViewInsights} onDelete={handleOpenDeleteDialog} />
                </CardContent>
              </Card>
            )}
            {!isProcessing && atsResults.length === 0 && (
                <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground py-8">
                            {uploadedResumeFiles.length > 0 ? 'Click "Find ATS Score" to begin.' : 'Upload resumes to get started. Your saved results will appear here.'}
                        </p>
                    </CardContent>
                </Card>
            )}
          </div>

          <AtsFeedbackModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            result={selectedResultForModal}
          />

          <AlertDialog open={!!resultToDelete} onOpenChange={(open) => !open && setResultToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the ATS score result for <span className="font-semibold">{resultToDelete?.resumeName}</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setResultToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all{" "}
                  <span className="font-semibold">{atsResults.length}</span> saved ATS score results.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsDeleteAllDialogOpen(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDeleteAll}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Yes, delete all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
