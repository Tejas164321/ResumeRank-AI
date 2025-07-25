
"use client";

import React from "react";
// UI Components
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
// Icons
import { Eye, ShieldCheck, FileText, User, Calendar, Trash2 } from "lucide-react";
// Types and Firebase
import type { AtsScoreResult } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

/**
 * Props for the AtsScoreTable component.
 */
interface AtsScoreTableProps {
  results: AtsScoreResult[];
  onViewInsights: (result: AtsScoreResult) => void;
  onDelete: (result: AtsScoreResult) => void;
}

/**
 * A responsive table/card list for displaying ATS score results.
 * It shows a table on larger screens and a list of cards on mobile.
 * @param {AtsScoreTableProps} props - The component props.
 */
export function AtsScoreTable({ results, onViewInsights, onDelete }: AtsScoreTableProps) {
  /**
   * Determines the color of the score badge based on the score value.
   * @param {number} score - The ATS score (0-100).
   * @returns {JSX.Element} A styled Badge component.
   */
  const getAtsScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-600 text-white hover:bg-green-600/90">{score}/100</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500 text-black hover:bg-yellow-500/90">{score}/100</Badge>;
    if (score >= 40) return <Badge className="bg-orange-500 text-white hover:bg-orange-500/90">{score}/100</Badge>;
    return <Badge variant="destructive">{score}/100</Badge>;
  };

  // Display a message if there are no results to show.
  if (results.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No results to display.</p>;
  }

  return (
    <>
      {/* Mobile View: Renders a list of cards. Hidden on medium screens and up. */}
      <div className="md:hidden space-y-4">
        {results.map((result, index) => (
          <Card key={result.id || index} className="bg-card">
            <CardHeader>
               <div className="flex justify-between items-start gap-4">
                  <div className="flex-grow">
                    <CardTitle className="text-base truncate" title={result.resumeName}>{result.resumeName}</CardTitle>
                    <CardDescription>{result.candidateName || <span className="italic">Candidate not extracted</span>}</CardDescription>
                  </div>
                  <div className="flex-shrink-0">{getAtsScoreBadge(result.atsScore)}</div>
               </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Analyzed on {result.createdAt instanceof Timestamp ? result.createdAt.toDate().toLocaleDateString() : 'N/A'}</span>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end items-center gap-2">
                 <Button variant="outline" size="sm" onClick={() => onViewInsights(result)} className="flex-1">
                    <Eye className="w-4 h-4 mr-2" /> Insights
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => onDelete(result)} aria-label={`Delete result for ${result.resumeName}`} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      
      {/* Desktop View: Renders a table. Hidden on small screens. */}
      <div className="hidden md:block rounded-lg border shadow-sm bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[5%] text-center">#</TableHead>
              <TableHead className="w-[30%]"><div className="flex items-center"><FileText className="w-4 h-4 mr-1 text-muted-foreground" />Resume File</div></TableHead>
              <TableHead className="w-[20%]"><div className="flex items-center"><User className="w-4 h-4 mr-1 text-muted-foreground" />Candidate Name</div></TableHead>
              <TableHead className="w-[15%]"><div className="flex items-center"><ShieldCheck className="w-4 h-4 mr-1 text-muted-foreground" />ATS Score</div></TableHead>
              <TableHead className="w-[15%]"><div className="flex items-center"><Calendar className="w-4 h-4 mr-1 text-muted-foreground" />Date Analyzed</div></TableHead>
              <TableHead className="text-right w-[15%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result, index) => (
              <TableRow key={result.id || index} className="transition-colors hover:bg-muted/50">
                <TableCell className="font-medium text-center">{index + 1}</TableCell>
                <TableCell className="font-medium truncate" title={result.resumeName}>{result.resumeName}</TableCell>
                <TableCell>{result.candidateName || <span className="text-muted-foreground italic">Not extracted</span>}</TableCell>
                <TableCell>{getAtsScoreBadge(result.atsScore)}</TableCell>
                <TableCell>{result.createdAt instanceof Timestamp ? result.createdAt.toDate().toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => onViewInsights(result)} aria-label={`View insights for ${result.resumeName}`} className="hover:text-primary"><Eye className="w-4 h-4 mr-2" />Insights</Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(result)} aria-label={`Delete result for ${result.resumeName}`} className="hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
